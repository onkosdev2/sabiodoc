import unicodedata
import re
from typing import List, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import or_, func
from app.models.specialty import Specialty
from app.core.logging import get_logger

logger = get_logger(__name__)


def remove_accents(text: str) -> str:
    nfkd_form = unicodedata.normalize('NFKD', text)
    return ''.join(c for c in nfkd_form if not unicodedata.combining(c))


def normalize_text(text: str) -> str:
    text = remove_accents(text.lower().strip())
    text = re.sub(r'[^a-z0-9\s]', '', text)
    return text


def get_search_variations(query: str) -> List[str]:
    normalized = normalize_text(query)
    variations = [normalized]
    
    suffix_patterns = [
        (r'logo$', ['logia', 'logo', 'loga', 'logía']),
        (r'loga$', ['logia', 'logo', 'loga', 'logía']),
        (r'logia$', ['logia', 'logo', 'loga', 'logía']),
        (r'logía$', ['logia', 'logo', 'loga', 'logía']),
        (r'ista$', ['ista', 'ia', 'ía']),
        (r'ia$', ['ia', 'ía', 'ista', 'ico', 'ica']),
        (r'ía$', ['ia', 'ía', 'ista', 'ico', 'ica']),
        (r'ico$', ['ico', 'ica', 'ia', 'ía']),
        (r'ica$', ['ico', 'ica', 'ia', 'ía']),
        (r'tra$', ['tra', 'tría', 'tria']),
        (r'tria$', ['tra', 'tría', 'tria']),
        (r'tría$', ['tra', 'tría', 'tria']),
    ]
    
    for pattern, replacements in suffix_patterns:
        if re.search(pattern, normalized):
            base = re.sub(pattern, '', normalized)
            for replacement in replacements:
                variations.append(base + replacement)
    
    if len(normalized) > 4:
        variations.append(normalized[:len(normalized)-1])
        variations.append(normalized[:len(normalized)-2])
    
    return list(set(variations))


class SearchService:
    def search_specialties(
        self,
        db: Session,
        query: str,
        limit: int = 20
    ) -> List[Tuple[Specialty, float]]:
        if not query or len(query.strip()) < 2:
            return []
        
        variations = get_search_variations(query)
        logger.info(f"Searching specialties with variations: {variations[:5]}...")
        
        all_specialties = db.query(Specialty).all()
        results = []
        
        for specialty in all_specialties:
            score = self._calculate_relevance(specialty, variations, query)
            if score > 0:
                results.append((specialty, score))
        
        results.sort(key=lambda x: x[1], reverse=True)
        
        return results[:limit]
    
    def _calculate_relevance(
        self,
        specialty: Specialty,
        variations: List[str],
        original_query: str
    ) -> float:
        score = 0.0
        
        name_normalized = normalize_text(specialty.name)
        slug_normalized = normalize_text(specialty.slug.replace('-', ' '))
        
        keywords_normalized = []
        if specialty.keywords:
            keywords_normalized = [normalize_text(k) for k in specialty.keywords]
        
        original_normalized = normalize_text(original_query)
        
        if original_normalized == name_normalized or original_normalized == slug_normalized:
            score += 100
        
        for variation in variations:
            if variation in name_normalized:
                score += 50
            if variation in slug_normalized:
                score += 40
            
            for keyword in keywords_normalized:
                if variation in keyword or keyword in variation:
                    score += 30
                if variation == keyword:
                    score += 20
        
        if name_normalized.startswith(original_normalized):
            score += 25
        if slug_normalized.startswith(original_normalized):
            score += 20
        
        return score


search_service = SearchService()

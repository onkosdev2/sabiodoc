"""Initial schema

Revision ID: 001
Revises: 
Create Date: 2024-01-01 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = '001'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table('users',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('email', sa.String(length=255), nullable=False),
        sa.Column('password_hash', sa.String(length=255), nullable=False),
        sa.Column('role', sa.Enum('patient', 'doctor', 'admin', name='userrole'), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_users_email'), 'users', ['email'], unique=True)
    op.create_index(op.f('ix_users_id'), 'users', ['id'], unique=False)

    op.create_table('specialties',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('slug', sa.String(length=100), nullable=False),
        sa.Column('name', sa.String(length=200), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('keywords', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('is_top', sa.Boolean(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_specialties_id'), 'specialties', ['id'], unique=False)
    op.create_index(op.f('ix_specialties_slug'), 'specialties', ['slug'], unique=True)

    op.create_table('triage_requests',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=True),
        sa.Column('symptoms_text', sa.Text(), nullable=False),
        sa.Column('result_json', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_triage_requests_id'), 'triage_requests', ['id'], unique=False)

    op.create_table('consultations',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('specialty_id', sa.Integer(), nullable=False),
        sa.Column('status', sa.Enum('created', 'active', 'closed', name='consultationstatus'), nullable=False),
        sa.Column('room_id', sa.String(length=100), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('closed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('summary', sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(['specialty_id'], ['specialties.id'], ),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('room_id')
    )
    op.create_index(op.f('ix_consultations_id'), 'consultations', ['id'], unique=False)

    op.create_table('favorites',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('specialty_id', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.ForeignKeyConstraint(['specialty_id'], ['specialties.id'], ),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id', 'specialty_id', name='uq_user_specialty_favorite')
    )
    op.create_index(op.f('ix_favorites_id'), 'favorites', ['id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_favorites_id'), table_name='favorites')
    op.drop_table('favorites')
    op.drop_index(op.f('ix_consultations_id'), table_name='consultations')
    op.drop_table('consultations')
    op.drop_index(op.f('ix_triage_requests_id'), table_name='triage_requests')
    op.drop_table('triage_requests')
    op.drop_index(op.f('ix_specialties_slug'), table_name='specialties')
    op.drop_index(op.f('ix_specialties_id'), table_name='specialties')
    op.drop_table('specialties')
    op.drop_index(op.f('ix_users_id'), table_name='users')
    op.drop_index(op.f('ix_users_email'), table_name='users')
    op.drop_table('users')
    
    op.execute('DROP TYPE IF EXISTS userrole')
    op.execute('DROP TYPE IF EXISTS consultationstatus')

import client from './client'

export interface ReviewReport {
  id: number
  review_id: number
  reason: string | null
  status: 'pending' | 'resolved' | 'dismissed'
  created_at: string
}

/** Reporta una reseña para que un administrador la revise. */
export const reportReview = async (reviewId: number, reason?: string): Promise<ReviewReport> => {
  const response = await client.post<ReviewReport>(`/reviews/${reviewId}/report`, {
    reason: reason?.trim() || null,
  })
  return response.data
}

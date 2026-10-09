import { describe, it, expect } from 'vitest'
import { parseReviewSession, visitReviewQuestion, type ReviewSession } from '../lib/review-session'
const s: ReviewSession = {version:1,userId:'owner',module:'Medicine',discipline:null,questionIds:['a','b'],currentIndex:0,viewedIds:['a'],gamificationEnabled:true,updatedAt:1}
describe('review persistence',()=>{
 it('preserves order and position without inventing answers',()=>{
  const next=visitReviewQuestion(s,1)
  expect(parseReviewSession(JSON.stringify(next),'owner')).toEqual(next)
  expect(next.questionIds).toEqual(['a','b'])
  expect(next.viewedIds).toEqual(['a','b'])
  expect(next).not.toHaveProperty('answers')
  expect(visitReviewQuestion(next,0).viewedIds).toEqual(['a','b'])
 })
 it('rejects another account and malformed saved sessions',()=>{
  for(const bad of [{...s,userId:'other'},{...s,currentIndex:2},{...s,questionIds:['a','a']},{...s,viewedIds:['x']},{...s,updatedAt:0},{...s,questionIds:[]}]) expect(parseReviewSession(JSON.stringify(bad),'owner')).toBeNull()
  expect(visitReviewQuestion(s,-1)).toBe(s)
 })
})

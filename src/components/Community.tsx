/**
 * Community —— 粉丝森林留言区
 *
 * Instagram + Notion 混合风格：动态、评论、点赞、收藏。
 */
import { useState } from 'react'
import { COMMUNITY_POSTS, type CommunityPost } from '../lib/nav'

export function Community() {
  const [posts, setPosts] = useState<CommunityPost[]>(COMMUNITY_POSTS)
  const [draft, setDraft] = useState('')

  const publish = () => {
    if (!draft.trim()) return
    setPosts((prev) => [
      { id: `c${Date.now()}`, author: 'you', content: draft.trim(), likes: 0, time: 'now' },
      ...prev,
    ])
    setDraft('')
  }

  const like = (id: string) => {
    setPosts((prev) =>
      prev.map((p) => (p.id === id ? { ...p, likes: p.likes + 1 } : p)),
    )
  }

  return (
    <main className="page">
      <header className="page-header">
        <p className="page-kicker">DEER COMMUNITY</p>
        <h1 className="page-title">COMMUNITY</h1>
        <p className="page-sub">粉丝森林留言区</p>
      </header>

      {/* 发布框 */}
      <div className="community-composer">
        <textarea
          className="community-input"
          placeholder="在森林里留下一句话…"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={2}
        />
        <button className="community-publish" onClick={publish} disabled={!draft.trim()}>
          发布
        </button>
      </div>

      {/* 动态流 */}
      <div className="community-feed">
        {posts.map((p) => (
          <article className="community-post" key={p.id}>
            <div className="community-post-head">
              <span className="community-author">@{p.author}</span>
              <span className="community-time">{p.time}</span>
            </div>
            <p className="community-content">{p.content}</p>
            <div className="community-actions">
              <button className="community-like" onClick={() => like(p.id)}>
                ♥ {p.likes}
              </button>
              <span className="community-collect" role="button" tabIndex={0} aria-label="收藏">
                ♢ 收藏
              </span>
            </div>
          </article>
        ))}
      </div>
    </main>
  )
}

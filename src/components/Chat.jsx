import { useState, useEffect, useRef } from 'react'
import { supabase } from '../supabase'

export default function Chat({ collaborateur }) {
  const [messages, setMessages] = useState([])
  const [newMsg, setNewMsg] = useState('')
  const [loading, setLoading] = useState(true)
  const [channel] = useState('general')
  const bottomRef = useRef(null)

  useEffect(() => {
    loadMessages()
    // Realtime subscription
    const sub = supabase
      .channel('chat-' + channel)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `channel=eq.${channel}` }, payload => {
        setMessages(prev => [...prev, payload.new])
      })
      .subscribe()
    return () => { supabase.removeChannel(sub) }
  }, [channel])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function loadMessages() {
    try {
      const { data } = await supabase.from('chat_messages').select('*').eq('channel', channel).order('created_at', { ascending: true }).limit(100)
      if (data) setMessages(data)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  async function sendMessage(e) {
    e.preventDefault()
    if (!newMsg.trim()) return
    const msg = newMsg.trim()
    setNewMsg('')
    try {
      await supabase.from('chat_messages').insert([{
        channel,
        sender_id: collaborateur.id,
        sender_name: `${collaborateur.prenom} ${collaborateur.nom}`,
        content: msg
      }])
    } catch (err) { console.error(err) }
  }

  const card = {
    background: 'rgba(30,41,59,0.8)', borderRadius: '16px',
    border: '1px solid rgba(212,175,55,0.12)', backdropFilter: 'blur(12px)', color: '#e2e8f0'
  }

  function formatTime(ts) {
    const d = new Date(ts)
    const today = new Date()
    const isToday = d.toDateString() === today.toDateString()
    if (isToday) return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }) + ' ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  }

  function getInitials(name) {
    return (name || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
  }

  const COLORS = ['#D4AF37', '#60a5fa', '#34d399', '#f59e0b', '#a78bfa', '#f87171', '#fb923c', '#e879f9']
  function getColor(name) { let h = 0; for (let i = 0; i < (name || '').length; i++) h = name.charCodeAt(i) + ((h << 5) - h); return COLORS[Math.abs(h) % COLORS.length] }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 180px)' }}>
      {/* Header */}
      <div style={{ ...card, padding: '1rem 1.5rem', marginBottom: '1rem', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span style={{ fontSize: '1.3rem' }}>💬</span>
          <div>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#fff', margin: 0 }}>Chat Équipe</h2>
            <p style={{ color: '#64748b', fontSize: '0.75rem', margin: 0 }}>#{channel} · {messages.length} messages</p>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div style={{ ...card, flex: 1, padding: '1rem', overflowY: 'auto', marginBottom: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {loading ? (
          <div style={{ textAlign: 'center', color: '#475569', padding: '2rem' }}>Chargement...</div>
        ) : messages.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#475569', padding: '2rem' }}>
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>💬</div>
            <div style={{ fontSize: '0.85rem' }}>Aucun message. Lancez la conversation !</div>
          </div>
        ) : messages.map((m, i) => {
          const isMe = m.sender_id === collaborateur.id
          const showAvatar = i === 0 || messages[i - 1]?.sender_id !== m.sender_id
          const color = getColor(m.sender_name)
          return (
            <div key={m.id || i} style={{ display: 'flex', flexDirection: isMe ? 'row-reverse' : 'row', gap: '0.5rem', alignItems: 'flex-end' }}>
              {showAvatar ? (
                <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: color + '25', border: `2px solid ${color}40`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', fontWeight: 700, color, flexShrink: 0 }}>{getInitials(m.sender_name)}</div>
              ) : <div style={{ width: '32px', flexShrink: 0 }} />}
              <div style={{ maxWidth: '70%' }}>
                {showAvatar && !isMe && <div style={{ fontSize: '0.68rem', color, fontWeight: 600, marginBottom: '0.15rem', marginLeft: '0.5rem' }}>{m.sender_name}</div>}
                <div style={{
                  padding: '0.6rem 0.9rem', borderRadius: isMe ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                  background: isMe ? 'rgba(212,175,55,0.15)' : 'rgba(255,255,255,0.06)',
                  border: isMe ? '1px solid rgba(212,175,55,0.25)' : '1px solid rgba(255,255,255,0.08)'
                }}>
                  <div style={{ fontSize: '0.85rem', color: '#e2e8f0', lineHeight: 1.4 }}>{m.content}</div>
                  <div style={{ fontSize: '0.6rem', color: '#475569', marginTop: '0.2rem', textAlign: isMe ? 'right' : 'left' }}>{formatTime(m.created_at)}</div>
                </div>
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form onSubmit={sendMessage} style={{ ...card, padding: '0.75rem', display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
        <input type="text" value={newMsg} onChange={e => setNewMsg(e.target.value)} placeholder="Votre message..." style={{ flex: 1, padding: '0.6rem 1rem', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '24px', color: '#e2e8f0', fontSize: '0.9rem', outline: 'none' }} />
        <button type="submit" disabled={!newMsg.trim()} style={{ background: 'linear-gradient(135deg, #D4AF37, #c9a02e)', border: 'none', borderRadius: '50%', width: '42px', height: '42px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: '1.1rem' }}>📤</button>
      </form>
    </div>
  )
}

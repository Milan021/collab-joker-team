import { useState, useEffect } from 'react'
import { supabase } from './supabase'
import Login from './components/Login'
import CRA from './components/CRA'
import Absences from './components/Absences'
import Chat from './components/Chat'

const TABS = [
  { id: 'cra', icon: '📅', label: 'Mon CRA' },
  { id: 'absences', icon: '🏖️', label: 'Absences' },
  { id: 'chat', icon: '💬', label: 'Chat' },
  { id: 'profil', icon: '👤', label: 'Mon Profil' }
]

export default function App() {
  const [user, setUser] = useState(null)
  const [collaborateur, setCollaborateur] = useState(null)
  const [activeTab, setActiveTab] = useState('cra')
  const [loading, setLoading] = useState(true)
  const [menuOpen, setMenuOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)
  const [editingProfil, setEditingProfil] = useState(false)
  const [profilForm, setProfilForm] = useState({})

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768)
      if (window.innerWidth >= 768) setMenuOpen(false)
    }
    window.addEventListener('resize', handleResize)
    return () => { subscription.unsubscribe(); window.removeEventListener('resize', handleResize) }
  }, [])

  useEffect(() => {
    if (user) loadCollaborateur()
  }, [user])

  async function loadCollaborateur() {
    setLoading(true)
    try {
      const { data } = await supabase.from('collaborateurs').select('*').eq('user_id', user.id).single()
      if (data) {
        setCollaborateur(data)
        setProfilForm(data)
      }
    } catch {
      // Collaborateur not found — create one with user email
      const prenom = user.email.split('@')[0].split('.')[0] || ''
      const nom = user.email.split('@')[0].split('.')[1] || ''
      const { data } = await supabase.from('collaborateurs').insert([{
        user_id: user.id,
        prenom: prenom.charAt(0).toUpperCase() + prenom.slice(1),
        nom: nom.charAt(0).toUpperCase() + nom.slice(1),
        email: user.email,
        statut: 'en_mission'
      }]).select()
      if (data?.[0]) {
        setCollaborateur(data[0])
        setProfilForm(data[0])
      }
    }
    finally { setLoading(false) }
  }

  async function updateProfil() {
    try {
      await supabase.from('collaborateurs').update({
        prenom: profilForm.prenom,
        nom: profilForm.nom,
        telephone: profilForm.telephone,
        poste: profilForm.poste,
        client_actuel: profilForm.client_actuel,
        mission_actuelle: profilForm.mission_actuelle
      }).eq('id', collaborateur.id)
      setCollaborateur({ ...collaborateur, ...profilForm })
      setEditingProfil(false)
    } catch (err) { alert('Erreur: ' + err.message) }
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    setUser(null); setCollaborateur(null)
  }

  if (!user) return <Login onLogin={setUser} />

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 40, height: 40, border: '3px solid rgba(212,175,55,0.2)', borderTopColor: '#D4AF37', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <style>{'@keyframes spin { to { transform: rotate(360deg) } }'}</style>
    </div>
  )

  if (!collaborateur) return (
    <div style={{ minHeight: '100vh', background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#e2e8f0' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>⚠️</div>
        <div style={{ fontSize: '1.1rem', fontWeight: 600 }}>Profil non trouvé</div>
        <div style={{ color: '#64748b', fontSize: '0.85rem', marginTop: '0.5rem' }}>Contactez votre manager pour configurer votre accès.</div>
        <button onClick={handleLogout} style={{ marginTop: '1.5rem', background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171', padding: '0.5rem 1.5rem', borderRadius: '8px', cursor: 'pointer' }}>Déconnexion</button>
      </div>
    </div>
  )

  const card = {
    background: 'rgba(30,41,59,0.8)', borderRadius: '16px',
    border: '1px solid rgba(212,175,55,0.12)', backdropFilter: 'blur(12px)', color: '#e2e8f0'
  }

  const inputStyle = { width: '100%', padding: '0.6rem 0.9rem', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#e2e8f0', fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box' }

  return (
    <div style={{ minHeight: '100vh', background: '#0f172a' }}>
      {/* Header */}
      <header style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)', borderBottom: '3px solid #D4AF37', boxShadow: '0 4px 16px rgba(0,0,0,0.3)', position: 'relative', zIndex: 300 }}>
        <div style={{ maxWidth: '1000px', margin: '0 auto', padding: isMobile ? '0.6rem 1rem' : '0.75rem 2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }} onClick={() => setActiveTab('cra')}>
            <img src="/logo-joker-team.png" alt="Joker Team" style={{ height: isMobile ? '36px' : '50px' }} onError={e => e.target.style.display = 'none'} />
            {!isMobile && <div>
              <div style={{ color: '#D4AF37', fontSize: '0.9rem', fontWeight: 700 }}>Espace Collaborateur</div>
              <div style={{ color: '#64748b', fontSize: '0.7rem' }}>{collaborateur.prenom} {collaborateur.nom}</div>
            </div>}
          </div>
          {isMobile ? (
            <button onClick={() => setMenuOpen(!menuOpen)} style={{ background: 'none', border: 'none', color: '#D4AF37', fontSize: '1.5rem', cursor: 'pointer' }}>{menuOpen ? '✕' : '☰'}</button>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              {TABS.map(t => (
                <button key={t.id} onClick={() => setActiveTab(t.id)} style={{
                  background: activeTab === t.id ? 'rgba(212,175,55,0.15)' : 'transparent',
                  border: activeTab === t.id ? '1px solid rgba(212,175,55,0.3)' : '1px solid transparent',
                  color: activeTab === t.id ? '#D4AF37' : '#64748b',
                  padding: '0.5rem 1rem', borderRadius: '8px', cursor: 'pointer', fontSize: '0.82rem', fontWeight: activeTab === t.id ? 600 : 400,
                  display: 'flex', alignItems: 'center', gap: '0.3rem'
                }}><span>{t.icon}</span> {t.label}</button>
              ))}
              <button onClick={handleLogout} style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171', padding: '0.4rem 0.8rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.75rem', marginLeft: '0.5rem' }}>🚪</button>
            </div>
          )}
        </div>
      </header>

      {/* Mobile menu */}
      {isMobile && menuOpen && (
        <>
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 250 }} onClick={() => setMenuOpen(false)} />
          <nav style={{ position: 'fixed', top: 0, left: 0, right: 0, background: '#0f172a', borderBottom: '3px solid #D4AF37', zIndex: 260, padding: '1rem 0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0 1.25rem 0.75rem', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <span style={{ color: '#D4AF37', fontWeight: 700 }}>{collaborateur.prenom} {collaborateur.nom}</span>
              <button onClick={() => setMenuOpen(false)} style={{ background: 'none', border: 'none', color: '#D4AF37', fontSize: '1.3rem', cursor: 'pointer' }}>✕</button>
            </div>
            {TABS.map(t => (
              <button key={t.id} onClick={() => { setActiveTab(t.id); setMenuOpen(false) }} style={{
                display: 'flex', alignItems: 'center', gap: '0.75rem', width: '100%', padding: '0.85rem 1.5rem',
                background: activeTab === t.id ? 'rgba(212,175,55,0.1)' : 'transparent',
                border: 'none', borderLeft: `3px solid ${activeTab === t.id ? '#D4AF37' : 'transparent'}`,
                color: activeTab === t.id ? '#D4AF37' : '#94a3b8', fontSize: '1rem', cursor: 'pointer', textAlign: 'left'
              }}><span style={{ fontSize: '1.2rem' }}>{t.icon}</span> {t.label}</button>
            ))}
            <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              <button onClick={handleLogout} style={{ width: '100%', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171', padding: '0.6rem', borderRadius: '8px', cursor: 'pointer' }}>🚪 Déconnexion</button>
            </div>
          </nav>
        </>
      )}

      {/* Main */}
      <main style={{ maxWidth: '1000px', margin: '0 auto', padding: isMobile ? '1rem 0.75rem 5rem' : '2rem' }}>
        {activeTab === 'cra' && <CRA collaborateur={collaborateur} />}
        {activeTab === 'absences' && <Absences collaborateur={collaborateur} />}
        {activeTab === 'chat' && <Chat collaborateur={collaborateur} />}
        {activeTab === 'profil' && (
          <div>
            <div style={{ ...card, padding: '1.5rem 2rem', marginBottom: '1.5rem' }}>
              <h2 style={{ fontSize: '1.3rem', fontWeight: 700, color: '#fff', margin: 0 }}>👤 Mon Profil</h2>
            </div>
            <div style={{ ...card, padding: '1.5rem' }}>
              {!editingProfil ? (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
                    <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'linear-gradient(135deg, #D4AF37, #c9a02e)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', fontWeight: 700, color: '#0f172a' }}>{(collaborateur.prenom?.[0] || '') + (collaborateur.nom?.[0] || '')}</div>
                    <div>
                      <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#fff' }}>{collaborateur.prenom} {collaborateur.nom}</div>
                      <div style={{ fontSize: '0.82rem', color: '#64748b' }}>{collaborateur.poste || 'Poste non défini'}</div>
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    {[
                      { label: 'Email', value: collaborateur.email, icon: '📧' },
                      { label: 'Téléphone', value: collaborateur.telephone || '—', icon: '📞' },
                      { label: 'Client actuel', value: collaborateur.client_actuel || '—', icon: '🏢' },
                      { label: 'Mission', value: collaborateur.mission_actuelle || '—', icon: '💼' },
                      { label: 'Date d\'entrée', value: collaborateur.date_entree ? new Date(collaborateur.date_entree).toLocaleDateString('fr-FR') : '—', icon: '📅' },
                      { label: 'Statut', value: collaborateur.statut === 'en_mission' ? '🟢 En mission' : collaborateur.statut === 'intercontrat' ? '🟡 Intercontrat' : '⚪ ' + (collaborateur.statut || ''), icon: '📊' }
                    ].map((f, i) => (
                      <div key={i} style={{ padding: '0.75rem', background: 'rgba(255,255,255,0.03)', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.04)' }}>
                        <div style={{ fontSize: '0.68rem', color: '#64748b', marginBottom: '0.2rem' }}>{f.icon} {f.label}</div>
                        <div style={{ fontSize: '0.9rem', color: '#e2e8f0', fontWeight: 500 }}>{f.value}</div>
                      </div>
                    ))}
                  </div>
                  <button onClick={() => setEditingProfil(true)} style={{ marginTop: '1.5rem', width: '100%', padding: '0.6rem', borderRadius: '8px', background: 'rgba(212,175,55,0.1)', border: '1px solid rgba(212,175,55,0.2)', color: '#D4AF37', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem' }}>✏️ Modifier mon profil</button>
                </div>
              ) : (
                <div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                    <div><div style={{ fontSize: '0.72rem', color: '#94a3b8', marginBottom: '0.3rem' }}>PRÉNOM</div><input value={profilForm.prenom || ''} onChange={e => setProfilForm({ ...profilForm, prenom: e.target.value })} style={inputStyle} /></div>
                    <div><div style={{ fontSize: '0.72rem', color: '#94a3b8', marginBottom: '0.3rem' }}>NOM</div><input value={profilForm.nom || ''} onChange={e => setProfilForm({ ...profilForm, nom: e.target.value })} style={inputStyle} /></div>
                    <div><div style={{ fontSize: '0.72rem', color: '#94a3b8', marginBottom: '0.3rem' }}>TÉLÉPHONE</div><input value={profilForm.telephone || ''} onChange={e => setProfilForm({ ...profilForm, telephone: e.target.value })} style={inputStyle} /></div>
                    <div><div style={{ fontSize: '0.72rem', color: '#94a3b8', marginBottom: '0.3rem' }}>POSTE</div><input value={profilForm.poste || ''} onChange={e => setProfilForm({ ...profilForm, poste: e.target.value })} style={inputStyle} /></div>
                    <div><div style={{ fontSize: '0.72rem', color: '#94a3b8', marginBottom: '0.3rem' }}>CLIENT ACTUEL</div><input value={profilForm.client_actuel || ''} onChange={e => setProfilForm({ ...profilForm, client_actuel: e.target.value })} style={inputStyle} /></div>
                    <div><div style={{ fontSize: '0.72rem', color: '#94a3b8', marginBottom: '0.3rem' }}>MISSION</div><input value={profilForm.mission_actuelle || ''} onChange={e => setProfilForm({ ...profilForm, mission_actuelle: e.target.value })} style={inputStyle} /></div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <button onClick={() => setEditingProfil(false)} style={{ flex: 1, padding: '0.6rem', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8', cursor: 'pointer' }}>Annuler</button>
                    <button onClick={updateProfil} style={{ flex: 1, padding: '0.6rem', borderRadius: '8px', background: 'linear-gradient(135deg, #D4AF37, #c9a02e)', border: 'none', color: '#0f172a', fontWeight: 700, cursor: 'pointer' }}>💾 Sauvegarder</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Mobile bottom bar */}
      {isMobile && !menuOpen && (
        <nav style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: '#0f172a', borderTop: '2px solid #D4AF37', display: 'flex', justifyContent: 'space-around', padding: '0.35rem 0 calc(0.35rem + env(safe-area-inset-bottom, 0px)) 0', zIndex: 200 }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)} style={{
              background: 'none', border: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.1rem',
              padding: '0.25rem 0.4rem', cursor: 'pointer', color: activeTab === t.id ? '#D4AF37' : '#475569', minWidth: '44px'
            }}>
              <span style={{ fontSize: '1.15rem' }}>{t.icon}</span>
              <span style={{ fontSize: '0.58rem', fontWeight: activeTab === t.id ? 600 : 400 }}>{t.label}</span>
            </button>
          ))}
        </nav>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg) } }
        @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
      `}</style>
    </div>
  )
}

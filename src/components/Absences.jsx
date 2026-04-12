import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

const TYPES = {
  conge: { label: 'Congé payé', icon: '🏖️', color: '#f59e0b' },
  rtt: { label: 'RTT', icon: '🕐', color: '#a78bfa' },
  maladie: { label: 'Arrêt maladie', icon: '🏥', color: '#f87171' },
  sans_solde: { label: 'Sans solde', icon: '📋', color: '#94a3b8' },
  autre: { label: 'Autre', icon: '📝', color: '#64748b' }
}

const STATUT_CONFIG = {
  en_attente: { label: 'En attente', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
  valide: { label: 'Validé', color: '#34d399', bg: 'rgba(52,211,153,0.1)' },
  refuse: { label: 'Refusé', color: '#f87171', bg: 'rgba(248,113,113,0.1)' }
}

export default function Absences({ collaborateur }) {
  const [absences, setAbsences] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ type: 'conge', date_debut: '', date_fin: '', motif: '' })
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => { loadAbsences() }, [])

  async function loadAbsences() {
    try {
      const { data } = await supabase.from('absences').select('*').eq('collaborateur_id', collaborateur.id).order('date_debut', { ascending: false })
      if (data) setAbsences(data)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  function calcNbJours(debut, fin) {
    if (!debut || !fin) return 0
    const d1 = new Date(debut); const d2 = new Date(fin)
    let count = 0
    const cur = new Date(d1)
    while (cur <= d2) {
      const dow = cur.getDay()
      if (dow !== 0 && dow !== 6) count++
      cur.setDate(cur.getDate() + 1)
    }
    return count
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSubmitting(true)
    try {
      const nbJours = calcNbJours(form.date_debut, form.date_fin)
      if (nbJours <= 0) { alert('Dates invalides'); return }
      await supabase.from('absences').insert([{
        collaborateur_id: collaborateur.id,
        type: form.type,
        date_debut: form.date_debut,
        date_fin: form.date_fin,
        nb_jours: nbJours,
        motif: form.motif || null
      }])
      setForm({ type: 'conge', date_debut: '', date_fin: '', motif: '' })
      setShowForm(false)
      loadAbsences()
    } catch (err) { alert('Erreur: ' + err.message) }
    finally { setSubmitting(false) }
  }

  const card = {
    background: 'rgba(30,41,59,0.8)', borderRadius: '16px',
    border: '1px solid rgba(212,175,55,0.12)', backdropFilter: 'blur(12px)', color: '#e2e8f0'
  }

  const thisYear = absences.filter(a => new Date(a.date_debut).getFullYear() === new Date().getFullYear())
  const totalConges = thisYear.filter(a => a.type === 'conge' && a.statut === 'valide').reduce((s, a) => s + a.nb_jours, 0)
  const totalRTT = thisYear.filter(a => a.type === 'rtt' && a.statut === 'valide').reduce((s, a) => s + a.nb_jours, 0)
  const enAttente = absences.filter(a => a.statut === 'en_attente').length

  return (
    <div>
      <div style={{ ...card, padding: '1.5rem 2rem', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h2 style={{ fontSize: '1.3rem', fontWeight: 700, color: '#fff', margin: 0 }}>🏖️ Mes Absences</h2>
            <p style={{ color: '#64748b', fontSize: '0.82rem', margin: '0.3rem 0 0' }}>Gérez vos demandes de congés et absences</p>
          </div>
          <button onClick={() => setShowForm(!showForm)} style={{ background: 'linear-gradient(135deg, #D4AF37, #c9a02e)', border: 'none', borderRadius: '8px', color: '#0f172a', padding: '0.6rem 1.4rem', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer' }}>{showForm ? '✕ Annuler' : '+ Nouvelle demande'}</button>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem', marginBottom: '1.5rem' }}>
        <div style={{ ...card, padding: '1rem', textAlign: 'center', borderTop: '3px solid #f59e0b' }}>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#f59e0b' }}>{totalConges}</div>
          <div style={{ fontSize: '0.72rem', color: '#64748b' }}>Congés pris</div>
        </div>
        <div style={{ ...card, padding: '1rem', textAlign: 'center', borderTop: '3px solid #a78bfa' }}>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#a78bfa' }}>{totalRTT}</div>
          <div style={{ fontSize: '0.72rem', color: '#64748b' }}>RTT pris</div>
        </div>
        <div style={{ ...card, padding: '1rem', textAlign: 'center', borderTop: '3px solid #60a5fa' }}>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#60a5fa' }}>{enAttente}</div>
          <div style={{ fontSize: '0.72rem', color: '#64748b' }}>En attente</div>
        </div>
      </div>

      {/* Form */}
      {showForm && (
        <div style={{ ...card, padding: '1.5rem', marginBottom: '1.5rem' }}>
          <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#D4AF37', marginBottom: '1rem', textTransform: 'uppercase' }}>Nouvelle demande</div>
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: '1rem' }}>
              <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginBottom: '0.3rem', fontWeight: 500 }}>TYPE</div>
              <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
                {Object.entries(TYPES).map(([k, v]) => (
                  <button key={k} type="button" onClick={() => setForm({ ...form, type: k })} style={{
                    padding: '0.4rem 0.8rem', borderRadius: '8px', cursor: 'pointer', fontSize: '0.78rem',
                    background: form.type === k ? v.color + '20' : 'rgba(255,255,255,0.04)',
                    border: form.type === k ? `1px solid ${v.color}50` : '1px solid rgba(255,255,255,0.08)',
                    color: form.type === k ? v.color : '#94a3b8', fontWeight: form.type === k ? 600 : 400
                  }}>{v.icon} {v.label}</button>
                ))}
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
              <div>
                <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginBottom: '0.3rem', fontWeight: 500 }}>DATE DÉBUT</div>
                <input type="date" required value={form.date_debut} onChange={e => setForm({ ...form, date_debut: e.target.value })} style={{ width: '100%', padding: '0.55rem 0.75rem', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#e2e8f0', fontSize: '0.85rem', outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <div>
                <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginBottom: '0.3rem', fontWeight: 500 }}>DATE FIN</div>
                <input type="date" required value={form.date_fin} onChange={e => setForm({ ...form, date_fin: e.target.value })} style={{ width: '100%', padding: '0.55rem 0.75rem', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#e2e8f0', fontSize: '0.85rem', outline: 'none', boxSizing: 'border-box' }} />
              </div>
            </div>
            {form.date_debut && form.date_fin && (
              <div style={{ fontSize: '0.82rem', color: '#D4AF37', fontWeight: 600, marginBottom: '0.75rem' }}>📅 {calcNbJours(form.date_debut, form.date_fin)} jour(s) ouvré(s)</div>
            )}
            <div style={{ marginBottom: '1rem' }}>
              <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginBottom: '0.3rem', fontWeight: 500 }}>MOTIF (optionnel)</div>
              <textarea value={form.motif} onChange={e => setForm({ ...form, motif: e.target.value })} rows={2} placeholder="Précisions..." style={{ width: '100%', padding: '0.55rem 0.75rem', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#e2e8f0', fontSize: '0.85rem', outline: 'none', resize: 'vertical', boxSizing: 'border-box' }} />
            </div>
            <button type="submit" disabled={submitting} style={{ width: '100%', padding: '0.7rem', borderRadius: '8px', background: 'linear-gradient(135deg, #D4AF37, #c9a02e)', border: 'none', color: '#0f172a', fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer' }}>{submitting ? '⏳ Envoi...' : '📤 Envoyer la demande'}</button>
          </form>
        </div>
      )}

      {/* List */}
      <div style={{ ...card, padding: '1.25rem' }}>
        <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#94a3b8', marginBottom: '0.75rem', textTransform: 'uppercase' }}>Historique</div>
        {absences.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#475569', padding: '2rem', fontSize: '0.85rem' }}>Aucune demande d'absence</div>
        ) : absences.map(a => {
          const t = TYPES[a.type] || TYPES.autre
          const s = STATUT_CONFIG[a.statut] || STATUT_CONFIG.en_attente
          return (
            <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem', borderRadius: '10px', marginBottom: '0.4rem', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <span style={{ fontSize: '1.2rem' }}>{t.icon}</span>
                <div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#e2e8f0' }}>{t.label}</div>
                  <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                    {new Date(a.date_debut).toLocaleDateString('fr-FR')} → {new Date(a.date_fin).toLocaleDateString('fr-FR')} · {a.nb_jours}j
                  </div>
                </div>
              </div>
              <span style={{ padding: '0.2rem 0.6rem', borderRadius: '8px', fontSize: '0.72rem', fontWeight: 600, color: s.color, background: s.bg }}>{s.label}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

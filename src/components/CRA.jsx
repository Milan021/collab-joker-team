import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

const JOUR_TYPES = {
  travaille: { label: 'Travaillé', color: '#34d399', short: 'T' },
  demi: { label: '½ journée', color: '#60a5fa', short: '½' },
  conge: { label: 'Congé', color: '#f59e0b', short: 'C' },
  rtt: { label: 'RTT', color: '#a78bfa', short: 'R' },
  maladie: { label: 'Maladie', color: '#f87171', short: 'M' },
  ferie: { label: 'Férié', color: '#64748b', short: 'F' },
  intercontrat: { label: 'Intercontrat', color: '#fb923c', short: 'I' },
  '': { label: '', color: 'transparent', short: '' }
}

const MOIS_NOMS = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre']
const JOURS_NOMS = ['Lun','Mar','Mer','Jeu','Ven','Sam','Dim']

export default function CRA({ collaborateur }) {
  const [mois, setMois] = useState(new Date().getMonth() + 1)
  const [annee, setAnnee] = useState(new Date().getFullYear())
  const [jours, setJours] = useState({})
  const [craId, setCraId] = useState(null)
  const [statut, setStatut] = useState('brouillon')
  const [commentaire, setCommentaire] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [projet, setProjet] = useState('')

  useEffect(() => { loadCRA() }, [mois, annee])

  async function loadCRA() {
    setLoading(true)
    try {
      const { data } = await supabase.from('cra')
        .select('*')
        .eq('collaborateur_id', collaborateur.id)
        .eq('mois', mois)
        .eq('annee', annee)
        .single()
      if (data) {
        setCraId(data.id)
        setJours(data.jours || {})
        setStatut(data.statut)
        setCommentaire(data.commentaire || '')
      } else {
        setCraId(null)
        setJours({})
        setStatut('brouillon')
        setCommentaire('')
      }
    } catch { setCraId(null); setJours({}); setStatut('brouillon'); setCommentaire('') }
    finally { setLoading(false) }
  }

  async function saveCRA() {
    setSaving(true)
    try {
      const totalT = Object.values(jours).filter(j => j.type === 'travaille').length
      const totalDemi = Object.values(jours).filter(j => j.type === 'demi').length * 0.5
      const totalAbs = Object.values(jours).filter(j => ['conge','rtt','maladie'].includes(j.type)).length
      const payload = {
        collaborateur_id: collaborateur.id,
        mois, annee, jours,
        total_jours_travailles: totalT + totalDemi,
        total_jours_absence: totalAbs,
        statut: 'brouillon',
        commentaire,
        updated_at: new Date().toISOString()
      }
      if (craId) {
        await supabase.from('cra').update(payload).eq('id', craId)
      } else {
        const { data } = await supabase.from('cra').insert([payload]).select()
        if (data?.[0]) setCraId(data[0].id)
      }
      setStatut('brouillon')
    } catch (err) { alert('Erreur: ' + err.message) }
    finally { setSaving(false) }
  }

  async function submitCRA() {
    await saveCRA()
    setSaving(true)
    try {
      await supabase.from('cra').update({ statut: 'soumis', updated_at: new Date().toISOString() }).eq('id', craId || '')
      setStatut('soumis')
    } catch (err) { alert('Erreur: ' + err.message) }
    finally { setSaving(false) }
  }

  function toggleDay(day) {
    if (statut === 'valide') return
    const key = String(day)
    const current = jours[key]?.type || ''
    const types = ['travaille', 'demi', 'conge', 'rtt', 'maladie', 'intercontrat', '']
    const nextIdx = (types.indexOf(current) + 1) % types.length
    const newJours = { ...jours }
    if (types[nextIdx] === '') {
      delete newJours[key]
    } else {
      newJours[key] = { type: types[nextIdx], projet: projet || collaborateur.client_actuel || '' }
    }
    setJours(newJours)
  }

  // Calendar grid
  function getDaysInMonth(m, y) { return new Date(y, m, 0).getDate() }
  function getFirstDayOfWeek(m, y) { const d = new Date(y, m - 1, 1).getDay(); return d === 0 ? 6 : d - 1 }

  const nbDays = getDaysInMonth(mois, annee)
  const firstDay = getFirstDayOfWeek(mois, annee)
  const totalTravaille = Object.values(jours).filter(j => j.type === 'travaille').length + Object.values(jours).filter(j => j.type === 'demi').length * 0.5
  const totalAbs = Object.values(jours).filter(j => ['conge','rtt','maladie'].includes(j.type)).length
  const totalInter = Object.values(jours).filter(j => j.type === 'intercontrat').length

  const card = {
    background: 'rgba(30,41,59,0.8)', borderRadius: '16px',
    border: '1px solid rgba(212,175,55,0.12)', backdropFilter: 'blur(12px)', color: '#e2e8f0'
  }

  const STATUT_CONFIG = {
    brouillon: { label: 'Brouillon', color: '#94a3b8', bg: 'rgba(148,163,184,0.1)' },
    soumis: { label: 'Soumis', color: '#60a5fa', bg: 'rgba(96,165,250,0.1)' },
    valide: { label: 'Validé', color: '#34d399', bg: 'rgba(52,211,153,0.1)' },
    refuse: { label: 'Refusé', color: '#f87171', bg: 'rgba(248,113,113,0.1)' }
  }
  const st = STATUT_CONFIG[statut] || STATUT_CONFIG.brouillon

  return (
    <div>
      {/* Header */}
      <div style={{ ...card, padding: '1.5rem 2rem', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h2 style={{ fontSize: '1.3rem', fontWeight: 700, color: '#fff', margin: 0 }}>📅 Compte Rendu d'Activité</h2>
            <p style={{ color: '#64748b', fontSize: '0.82rem', margin: '0.3rem 0 0' }}>{collaborateur.prenom} {collaborateur.nom} — {collaborateur.client_actuel || 'Pas de mission'}</p>
          </div>
          <span style={{ padding: '0.3rem 0.8rem', borderRadius: '8px', fontSize: '0.78rem', fontWeight: 600, color: st.color, background: st.bg }}>{st.label}</span>
        </div>
      </div>

      {/* Month selector */}
      <div style={{ ...card, padding: '1rem 1.5rem', marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button onClick={() => { if (mois === 1) { setMois(12); setAnnee(annee - 1) } else setMois(mois - 1) }} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#e2e8f0', padding: '0.4rem 0.8rem', borderRadius: '8px', cursor: 'pointer', fontSize: '1rem' }}>◀</button>
        <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#D4AF37' }}>{MOIS_NOMS[mois - 1]} {annee}</div>
        <button onClick={() => { if (mois === 12) { setMois(1); setAnnee(annee + 1) } else setMois(mois + 1) }} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#e2e8f0', padding: '0.4rem 0.8rem', borderRadius: '8px', cursor: 'pointer', fontSize: '1rem' }}>▶</button>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem', marginBottom: '1rem' }}>
        <div style={{ ...card, padding: '1rem', textAlign: 'center', borderTop: '3px solid #34d399' }}>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#34d399' }}>{totalTravaille}</div>
          <div style={{ fontSize: '0.72rem', color: '#64748b' }}>Jours travaillés</div>
        </div>
        <div style={{ ...card, padding: '1rem', textAlign: 'center', borderTop: '3px solid #f59e0b' }}>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#f59e0b' }}>{totalAbs}</div>
          <div style={{ fontSize: '0.72rem', color: '#64748b' }}>Jours absence</div>
        </div>
        <div style={{ ...card, padding: '1rem', textAlign: 'center', borderTop: '3px solid #fb923c' }}>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#fb923c' }}>{totalInter}</div>
          <div style={{ fontSize: '0.72rem', color: '#64748b' }}>Intercontrat</div>
        </div>
      </div>

      {/* Projet input */}
      <div style={{ ...card, padding: '0.75rem 1.25rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <span style={{ fontSize: '0.78rem', color: '#94a3b8', fontWeight: 500 }}>Projet/Client :</span>
        <input type="text" value={projet || collaborateur.client_actuel || ''} onChange={e => setProjet(e.target.value)} placeholder="Nom du client ou projet" style={{ flex: 1, padding: '0.4rem 0.75rem', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: '#e2e8f0', fontSize: '0.85rem', outline: 'none' }} />
      </div>

      {/* Calendar */}
      <div style={{ ...card, padding: '1.25rem', marginBottom: '1rem' }}>
        {/* Legend */}
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
          {Object.entries(JOUR_TYPES).filter(([k]) => k !== '').map(([k, v]) => (
            <div key={k} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.68rem', color: '#94a3b8' }}>
              <div style={{ width: '12px', height: '12px', borderRadius: '3px', background: v.color }} />
              {v.label}
            </div>
          ))}
        </div>

        {/* Day headers */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px', marginBottom: '4px' }}>
          {JOURS_NOMS.map(j => (
            <div key={j} style={{ textAlign: 'center', fontSize: '0.7rem', fontWeight: 600, color: '#64748b', padding: '0.3rem' }}>{j}</div>
          ))}
        </div>

        {/* Days grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px' }}>
          {Array.from({ length: firstDay }).map((_, i) => <div key={'e' + i} />)}
          {Array.from({ length: nbDays }).map((_, i) => {
            const day = i + 1
            const dayOfWeek = (firstDay + i) % 7
            const isWeekend = dayOfWeek >= 5
            const jourData = jours[String(day)]
            const jourType = jourData?.type || ''
            const config = JOUR_TYPES[jourType] || JOUR_TYPES['']
            return (
              <div key={day} onClick={() => !isWeekend && toggleDay(day)} style={{
                aspectRatio: '1', borderRadius: '8px', display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center', cursor: isWeekend || statut === 'valide' ? 'default' : 'pointer',
                background: isWeekend ? 'rgba(255,255,255,0.02)' : jourType ? config.color + '20' : 'rgba(255,255,255,0.04)',
                border: jourType ? `2px solid ${config.color}40` : '1px solid rgba(255,255,255,0.06)',
                opacity: isWeekend ? 0.3 : 1, transition: 'all 0.15s'
              }}>
                <div style={{ fontSize: '0.85rem', fontWeight: 600, color: jourType ? config.color : '#e2e8f0' }}>{day}</div>
                {jourType && <div style={{ fontSize: '0.6rem', fontWeight: 700, color: config.color }}>{config.short}</div>}
              </div>
            )
          })}
        </div>
      </div>

      {/* Comment */}
      <div style={{ ...card, padding: '1rem 1.25rem', marginBottom: '1rem' }}>
        <div style={{ fontSize: '0.78rem', color: '#94a3b8', marginBottom: '0.3rem', fontWeight: 500 }}>Commentaire (optionnel)</div>
        <textarea value={commentaire} onChange={e => setCommentaire(e.target.value)} placeholder="Remarques, heures supplémentaires, détails..." rows={2} style={{ width: '100%', padding: '0.55rem 0.75rem', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#e2e8f0', fontSize: '0.85rem', outline: 'none', resize: 'vertical', boxSizing: 'border-box' }} />
      </div>

      {/* Actions */}
      {statut !== 'valide' && (
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button onClick={saveCRA} disabled={saving} style={{ flex: 1, padding: '0.7rem', borderRadius: '8px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#e2e8f0', fontWeight: 600, fontSize: '0.9rem', cursor: 'pointer' }}>{saving ? '⏳ ...' : '💾 Sauvegarder'}</button>
          <button onClick={submitCRA} disabled={saving || Object.keys(jours).length === 0} style={{ flex: 1, padding: '0.7rem', borderRadius: '8px', background: 'linear-gradient(135deg, #D4AF37, #c9a02e)', border: 'none', color: '#0f172a', fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer' }}>{saving ? '⏳ ...' : '📤 Soumettre'}</button>
        </div>
      )}
    </div>
  )
}

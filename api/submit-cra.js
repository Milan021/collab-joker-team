// API Vercel : /api/submit-cra.js
// Génère un PDF du CRA et l'envoie par email au manager

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })

  try {
    const { collaborateur, mois, annee, jours, total_jours_travailles, total_jours_absence, commentaire } = req.body
    const RESEND_KEY = process.env.RESEND_API_KEY
    if (!RESEND_KEY) return res.status(500).json({ error: 'Clé Resend manquante' })

    const MOIS_NOMS = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre']
    const JOURS_SEMAINE = ['Dim','Lun','Mar','Mer','Jeu','Ven','Sam']
    const moisNom = MOIS_NOMS[(mois || 1) - 1]

    const JOUR_LABELS = {
      travaille: { label: 'Travaillé', color: '#34d399', bg: '#065f46' },
      demi: { label: '½ journée', color: '#60a5fa', bg: '#1e3a5f' },
      conge: { label: 'Congé', color: '#f59e0b', bg: '#78350f' },
      rtt: { label: 'RTT', color: '#a78bfa', bg: '#4c1d95' },
      maladie: { label: 'Maladie', color: '#f87171', bg: '#7f1d1d' },
      intercontrat: { label: 'Intercontrat', color: '#fb923c', bg: '#7c2d12' },
      ferie: { label: 'Férié', color: '#64748b', bg: '#334155' }
    }

    // Build calendar HTML
    const nbDays = new Date(annee, mois, 0).getDate()
    let calendarRows = ''
    for (let d = 1; d <= nbDays; d++) {
      const date = new Date(annee, mois - 1, d)
      const dow = date.getDay()
      const isWeekend = dow === 0 || dow === 6
      const jourData = jours?.[String(d)]
      const type = jourData?.type || ''
      const projet = jourData?.projet || ''
      const config = JOUR_LABELS[type]

      calendarRows += `<tr style="border-bottom: 1px solid #1e293b;">
        <td style="padding: 6px 10px; color: ${isWeekend ? '#475569' : '#e2e8f0'}; font-weight: 500;">${JOURS_SEMAINE[dow]} ${d}</td>
        <td style="padding: 6px 10px; text-align: center;">
          ${type ? `<span style="padding: 2px 8px; border-radius: 4px; font-size: 12px; font-weight: 600; color: ${config?.color || '#94a3b8'}; background: ${config?.bg || '#1e293b'};">${config?.label || type}</span>` : (isWeekend ? '<span style="color: #475569; font-size: 12px;">Weekend</span>' : '')}
        </td>
        <td style="padding: 6px 10px; color: #94a3b8; font-size: 12px;">${projet}</td>
      </tr>`
    }

    // Count by type
    const typeCounts = {}
    Object.values(jours || {}).forEach(j => {
      if (j.type) typeCounts[j.type] = (typeCounts[j.type] || 0) + 1
    })
    let summaryHtml = ''
    Object.entries(typeCounts).forEach(([type, count]) => {
      const config = JOUR_LABELS[type] || {}
      summaryHtml += `<span style="display: inline-block; padding: 4px 12px; border-radius: 6px; font-size: 13px; font-weight: 600; color: ${config.color || '#94a3b8'}; background: ${config.bg || '#1e293b'}; margin: 2px 4px;">${config.label || type}: ${count}j</span>`
    })

    const totalInter = typeCounts['intercontrat'] || 0

    // Generate HTML for PDF-like email
    const htmlContent = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 700px; margin: 0 auto; background: #0f172a; color: #e2e8f0; border-radius: 12px; overflow: hidden; border: 2px solid #D4AF37;">
      <!-- Header -->
      <div style="background: linear-gradient(135deg, #122a33, #1a3a45); padding: 24px 30px; border-bottom: 3px solid #D4AF37;">
        <div style="display: flex; align-items: center; gap: 12px;">
          <div style="font-size: 24px;">📅</div>
          <div>
            <h1 style="margin: 0; font-size: 20px; color: #D4AF37;">Compte Rendu d'Activité</h1>
            <p style="margin: 4px 0 0; font-size: 14px; color: #8ba5b0;">${moisNom} ${annee}</p>
          </div>
        </div>
      </div>

      <!-- Collaborateur info -->
      <div style="padding: 20px 30px; background: rgba(30,41,59,0.5); border-bottom: 1px solid #1e293b;">
        <table style="width: 100%;">
          <tr>
            <td style="padding: 4px 0; font-size: 13px; color: #64748b; width: 120px;">Collaborateur</td>
            <td style="padding: 4px 0; font-size: 14px; color: #e2e8f0; font-weight: 600;">${collaborateur?.prenom || ''} ${collaborateur?.nom || ''}</td>
          </tr>
          <tr>
            <td style="padding: 4px 0; font-size: 13px; color: #64748b;">Email</td>
            <td style="padding: 4px 0; font-size: 14px; color: #e2e8f0;">${collaborateur?.email || ''}</td>
          </tr>
          <tr>
            <td style="padding: 4px 0; font-size: 13px; color: #64748b;">Client / Mission</td>
            <td style="padding: 4px 0; font-size: 14px; color: #D4AF37; font-weight: 600;">${collaborateur?.client_actuel || 'Non renseigné'}</td>
          </tr>
          <tr>
            <td style="padding: 4px 0; font-size: 13px; color: #64748b;">Poste</td>
            <td style="padding: 4px 0; font-size: 14px; color: #e2e8f0;">${collaborateur?.poste || 'Non renseigné'}</td>
          </tr>
        </table>
      </div>

      <!-- Summary -->
      <div style="padding: 20px 30px; border-bottom: 1px solid #1e293b;">
        <h3 style="margin: 0 0 12px; font-size: 14px; color: #D4AF37; text-transform: uppercase; letter-spacing: 0.05em;">Résumé</h3>
        <div style="display: flex; gap: 12px; margin-bottom: 12px;">
          <div style="flex: 1; text-align: center; padding: 12px; background: rgba(52,211,153,0.1); border-radius: 8px; border: 1px solid rgba(52,211,153,0.2);">
            <div style="font-size: 24px; font-weight: 700; color: #34d399;">${total_jours_travailles || 0}</div>
            <div style="font-size: 11px; color: #64748b;">Jours travaillés</div>
          </div>
          <div style="flex: 1; text-align: center; padding: 12px; background: rgba(245,158,11,0.1); border-radius: 8px; border: 1px solid rgba(245,158,11,0.2);">
            <div style="font-size: 24px; font-weight: 700; color: #f59e0b;">${total_jours_absence || 0}</div>
            <div style="font-size: 11px; color: #64748b;">Jours absence</div>
          </div>
          <div style="flex: 1; text-align: center; padding: 12px; background: rgba(251,146,60,0.1); border-radius: 8px; border: 1px solid rgba(251,146,60,0.2);">
            <div style="font-size: 24px; font-weight: 700; color: #fb923c;">${totalInter}</div>
            <div style="font-size: 11px; color: #64748b;">Intercontrat</div>
          </div>
        </div>
        <div>${summaryHtml}</div>
      </div>

      <!-- Calendar detail -->
      <div style="padding: 20px 30px;">
        <h3 style="margin: 0 0 12px; font-size: 14px; color: #60a5fa; text-transform: uppercase; letter-spacing: 0.05em;">Détail jour par jour</h3>
        <table style="width: 100%; border-collapse: collapse;">
          <thead>
            <tr style="border-bottom: 2px solid #334155;">
              <th style="padding: 8px 10px; text-align: left; font-size: 11px; color: #64748b; text-transform: uppercase;">Jour</th>
              <th style="padding: 8px 10px; text-align: center; font-size: 11px; color: #64748b; text-transform: uppercase;">Statut</th>
              <th style="padding: 8px 10px; text-align: left; font-size: 11px; color: #64748b; text-transform: uppercase;">Projet</th>
            </tr>
          </thead>
          <tbody>
            ${calendarRows}
          </tbody>
        </table>
      </div>

      ${commentaire ? `
      <div style="padding: 16px 30px; border-top: 1px solid #1e293b; background: rgba(30,41,59,0.5);">
        <h3 style="margin: 0 0 6px; font-size: 13px; color: #94a3b8;">💬 Commentaire</h3>
        <p style="margin: 0; font-size: 14px; color: #e2e8f0; line-height: 1.5;">${commentaire}</p>
      </div>` : ''}

      <!-- Footer -->
      <div style="padding: 16px 30px; border-top: 2px solid #D4AF37; text-align: center;">
        <p style="margin: 0; font-size: 12px; color: #64748b;">Soumis le ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</p>
        <p style="margin: 4px 0 0; font-size: 11px; color: #475569;">Joker Team — Espace Collaborateur</p>
      </div>
    </div>`

    // Send email via Resend
    const emailResp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_KEY}`
      },
      body: JSON.stringify({
        from: 'Joker Team CRA <onboarding@resend.dev>',
        to: ['milan.calic@joker-team.fr'],
        subject: `📅 CRA ${moisNom} ${annee} — ${collaborateur?.prenom || ''} ${collaborateur?.nom || ''} (${total_jours_travailles || 0}j travaillés)`,
        html: htmlContent
      })
    })

    if (!emailResp.ok) {
      const errData = await emailResp.text()
      console.error('Resend error:', errData)
      return res.status(500).json({ error: 'Erreur envoi email' })
    }

    const emailResult = await emailResp.json()
    res.status(200).json({ success: true, emailId: emailResult.id })

  } catch (error) {
    console.error('Submit CRA error:', error)
    res.status(500).json({ error: error.message })
  }
}

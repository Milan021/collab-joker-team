// API Vercel : /api/analyze-document.js
// Analyse un document uploadé et détecte les données CRA

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })

  try {
    const { filename, filetype, content, image_base64, collaborateur } = req.body
    const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY
    if (!ANTHROPIC_KEY) return res.status(500).json({ error: 'Clé API manquante' })

    const messages = []
    const userContent = []

    // If image, send as vision
    if (image_base64) {
      const mediaType = filetype?.includes('png') ? 'image/png' : 'image/jpeg'
      userContent.push({
        type: 'image',
        source: { type: 'base64', media_type: mediaType, data: image_base64 }
      })
    }

    userContent.push({
      type: 'text',
      text: `Analyse ce document uploadé par un collaborateur ESN.

Nom du fichier : ${filename}
Type : ${filetype || 'inconnu'}
Collaborateur : ${collaborateur?.prenom || ''} ${collaborateur?.nom || ''}
Client actuel : ${collaborateur?.client || 'Non renseigné'}

${content ? `Contenu du fichier :\n${content}` : ''}

Analyse ce document et détermine :
1. La catégorie (cra, fiche_paie, justificatif, contrat, facture, autre)
2. Une description courte du contenu
3. Si c'est un CRA/timesheet/feuille de temps, extrais les données :
   - Mois et année
   - Nombre de jours travaillés
   - Nombre de jours d'absence
   - Nom du client/projet
   - Détails par jour si possible (format: { "1": {"type": "travaille"}, "2": {"type": "travaille"}, "15": {"type": "conge"} })
   Les types possibles sont : travaille, demi, conge, rtt, maladie, intercontrat

Réponds UNIQUEMENT en JSON :
{
  "categorie_detectee": "cra",
  "description": "Feuille de temps du mois de mars 2026",
  "cra_data": {
    "mois": 3,
    "annee": 2026,
    "jours_travailles": 20,
    "jours_absence": 2,
    "client": "BNP Paribas",
    "jours": { "1": {"type": "travaille", "projet": "BNP"}, "2": {"type": "travaille", "projet": "BNP"} }
  }
}

Si ce n'est PAS un CRA, mets cra_data à null.`
    })

    messages.push({ role: 'user', content: userContent })

    const claudeResp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2000,
        system: 'Tu es un assistant spécialisé dans l\'analyse de documents RH et CRA pour une ESN française. Tu extrais les données pertinentes des documents uploadés.',
        messages
      })
    })

    if (!claudeResp.ok) {
      const errText = await claudeResp.text()
      console.error('Anthropic error:', errText)
      return res.status(500).json({ error: 'Erreur analyse IA' })
    }

    const aiData = await claudeResp.json()
    let result = aiData.content?.[0]?.text || '{}'
    result = result.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()
    const parsed = JSON.parse(result)

    res.status(200).json(parsed)

  } catch (error) {
    console.error('Analyze error:', error)
    res.status(500).json({ error: error.message })
  }
}

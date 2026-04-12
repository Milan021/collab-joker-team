import { useState, useEffect, useRef } from 'react'
import { supabase } from '../supabase'

const CATEGORIES = {
  cra: { label: 'CRA / Timesheet', icon: '📅', color: '#D4AF37' },
  fiche_paie: { label: 'Fiche de paie', icon: '💰', color: '#34d399' },
  justificatif: { label: 'Justificatif', icon: '📋', color: '#60a5fa' },
  contrat: { label: 'Contrat', icon: '📝', color: '#a78bfa' },
  facture: { label: 'Facture', icon: '🧾', color: '#f59e0b' },
  autre: { label: 'Autre', icon: '📎', color: '#94a3b8' }
}

function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' o'
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' Ko'
  return (bytes / 1048576).toFixed(1) + ' Mo'
}

export default function Documents({ collaborateur, onCRAData }) {
  const [documents, setDocuments] = useState([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [analysisResult, setAnalysisResult] = useState(null)
  const [selectedDoc, setSelectedDoc] = useState(null)
  const fileRef = useRef(null)

  useEffect(() => { loadDocuments() }, [])

  async function loadDocuments() {
    try {
      const { data } = await supabase.from('documents').select('*').eq('collaborateur_id', collaborateur.id).order('created_at', { ascending: false })
      if (data) setDocuments(data)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  async function handleFiles(files) {
    if (!files || files.length === 0) return
    setUploading(true)
    try {
      for (const file of files) {
        const ext = file.name.split('.').pop().toLowerCase()
        const path = `${collaborateur.id}/${Date.now()}_${file.name}`

        // Upload to storage
        const { error: uploadErr } = await supabase.storage.from('documents').upload(path, file)
        if (uploadErr) { console.error('Upload error:', uploadErr); continue }

        // Detect category
        let categorie = 'autre'
        const nameLower = file.name.toLowerCase()
        if (nameLower.includes('cra') || nameLower.includes('timesheet') || nameLower.includes('activit')) categorie = 'cra'
        else if (nameLower.includes('paie') || nameLower.includes('salaire') || nameLower.includes('bulletin')) categorie = 'fiche_paie'
        else if (nameLower.includes('justif') || nameLower.includes('attestation') || nameLower.includes('certificat')) categorie = 'justificatif'
        else if (nameLower.includes('contrat') || nameLower.includes('avenant')) categorie = 'contrat'
        else if (nameLower.includes('facture') || nameLower.includes('invoice')) categorie = 'facture'

        // Save to DB
        const { data: doc } = await supabase.from('documents').insert([{
          collaborateur_id: collaborateur.id,
          nom_fichier: file.name,
          type_fichier: file.type || ext,
          taille: file.size,
          categorie,
          storage_path: path
        }]).select()

        if (doc?.[0]) {
          setDocuments(prev => [doc[0], ...prev])

          // If it looks like a CRA, try to analyze it
          if (categorie === 'cra' || ['xlsx', 'xls', 'csv', 'pdf', 'png', 'jpg', 'jpeg'].includes(ext)) {
            await analyzeForCRA(file, doc[0])
          }
        }
      }
    } catch (err) { console.error('Upload error:', err) }
    finally { setUploading(false) }
  }

  async function analyzeForCRA(file, docRecord) {
    setAnalyzing(true)
    setAnalysisResult(null)
    try {
      // Read file as base64 for images, or text for CSV
      const ext = file.name.split('.').pop().toLowerCase()
      let fileContent = ''
      let isImage = false

      if (['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(ext)) {
        isImage = true
        fileContent = await readFileAsBase64(file)
      } else if (['csv', 'txt'].includes(ext)) {
        fileContent = await readFileAsText(file)
      } else if (['xlsx', 'xls'].includes(ext)) {
        fileContent = `[Fichier Excel: ${file.name}, taille: ${formatSize(file.size)}. Analyse basée sur le nom du fichier et les métadonnées.]`
      } else if (ext === 'pdf') {
        fileContent = `[Fichier PDF: ${file.name}, taille: ${formatSize(file.size)}. Analyse basée sur le nom du fichier.]`
      }

      // Call AI to analyze
      const resp = await fetch('/api/analyze-document', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: file.name,
          filetype: file.type,
          content: isImage ? null : fileContent?.slice(0, 5000),
          image_base64: isImage ? fileContent : null,
          collaborateur: { nom: collaborateur.nom, prenom: collaborateur.prenom, client: collaborateur.client_actuel }
        })
      })

      if (resp.ok) {
        const result = await resp.json()
        setAnalysisResult(result)

        // Save CRA data to document
        if (result.cra_data) {
          await supabase.from('documents').update({ cra_data: result.cra_data, categorie: 'cra' }).eq('id', docRecord.id)
        }
      }
    } catch (err) { console.error('Analysis error:', err) }
    finally { setAnalyzing(false) }
  }

  function readFileAsBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result.split(',')[1])
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
  }

  function readFileAsText(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result)
      reader.onerror = reject
      reader.readAsText(file)
    })
  }

  async function applyCRAData() {
    if (!analysisResult?.cra_data && !selectedDoc?.cra_data) return
    const craData = analysisResult?.cra_data || selectedDoc?.cra_data
    if (onCRAData) {
      onCRAData(craData)
      setAnalysisResult(prev => prev ? { ...prev, applied: true } : null)
    }
  }

  async function deleteDocument(doc) {
    if (!confirm('Supprimer ce document ?')) return
    try {
      await supabase.storage.from('documents').remove([doc.storage_path])
      await supabase.from('documents').delete().eq('id', doc.id)
      setDocuments(prev => prev.filter(d => d.id !== doc.id))
      if (selectedDoc?.id === doc.id) setSelectedDoc(null)
    } catch (err) { console.error(err) }
  }

  async function downloadDocument(doc) {
    try {
      const { data } = await supabase.storage.from('documents').download(doc.storage_path)
      if (data) {
        const url = URL.createObjectURL(data)
        const a = document.createElement('a')
        a.href = url; a.download = doc.nom_fichier; a.click()
        URL.revokeObjectURL(url)
      }
    } catch (err) { console.error(err) }
  }

  function handleDrop(e) {
    e.preventDefault(); setDragOver(false)
    handleFiles(e.dataTransfer.files)
  }

  const card = {
    background: 'rgba(30,41,59,0.8)', borderRadius: '16px',
    border: '1px solid rgba(212,175,55,0.12)', backdropFilter: 'blur(12px)', color: '#e2e8f0'
  }

  const totalDocs = documents.length
  const totalSize = documents.reduce((s, d) => s + (d.taille || 0), 0)
  const craCount = documents.filter(d => d.categorie === 'cra').length

  return (
    <div>
      {/* Header */}
      <div style={{ ...card, padding: '1.5rem 2rem', marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '1.3rem', fontWeight: 700, color: '#fff', margin: 0 }}>📁 Mes Documents</h2>
        <p style={{ color: '#64748b', fontSize: '0.82rem', margin: '0.3rem 0 0' }}>Uploadez vos documents — l'IA détecte et pré-remplit votre CRA</p>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem', marginBottom: '1.5rem' }}>
        <div style={{ ...card, padding: '1rem', textAlign: 'center', borderTop: '3px solid #D4AF37' }}>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#D4AF37' }}>{totalDocs}</div>
          <div style={{ fontSize: '0.72rem', color: '#64748b' }}>Documents</div>
        </div>
        <div style={{ ...card, padding: '1rem', textAlign: 'center', borderTop: '3px solid #60a5fa' }}>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#60a5fa' }}>{formatSize(totalSize)}</div>
          <div style={{ fontSize: '0.72rem', color: '#64748b' }}>Espace utilisé</div>
        </div>
        <div style={{ ...card, padding: '1rem', textAlign: 'center', borderTop: '3px solid #34d399' }}>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#34d399' }}>{craCount}</div>
          <div style={{ fontSize: '0.72rem', color: '#64748b' }}>CRA détectés</div>
        </div>
      </div>

      {/* Upload zone */}
      <div
        onDragOver={e => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileRef.current?.click()}
        style={{
          ...card, padding: '2.5rem', marginBottom: '1.5rem', textAlign: 'center', cursor: 'pointer',
          border: dragOver ? '2px dashed #D4AF37' : '2px dashed rgba(255,255,255,0.1)',
          background: dragOver ? 'rgba(212,175,55,0.05)' : 'rgba(30,41,59,0.8)',
          transition: 'all 0.2s'
        }}
      >
        <input ref={fileRef} type="file" multiple hidden onChange={e => handleFiles(e.target.files)} />
        {uploading ? (
          <>
            <div style={{ width: 40, height: 40, border: '3px solid rgba(212,175,55,0.2)', borderTopColor: '#D4AF37', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 1rem' }} />
            <div style={{ color: '#D4AF37', fontWeight: 600 }}>Upload en cours...</div>
          </>
        ) : (
          <>
            <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>📤</div>
            <div style={{ fontSize: '1rem', fontWeight: 600, color: '#e2e8f0', marginBottom: '0.3rem' }}>Glissez vos fichiers ici</div>
            <div style={{ fontSize: '0.82rem', color: '#64748b' }}>ou cliquez pour parcourir · Tous formats acceptés</div>
            <div style={{ fontSize: '0.72rem', color: '#D4AF37', marginTop: '0.5rem' }}>🤖 L'IA analysera automatiquement les CRA et timesheets</div>
          </>
        )}
      </div>

      {/* AI Analysis result */}
      {analyzing && (
        <div style={{ ...card, padding: '1.25rem', marginBottom: '1rem', borderLeft: '4px solid #D4AF37', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ width: 24, height: 24, border: '2px solid rgba(212,175,55,0.2)', borderTopColor: '#D4AF37', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          <div>
            <div style={{ fontSize: '0.85rem', color: '#D4AF37', fontWeight: 600 }}>🤖 Analyse IA en cours...</div>
            <div style={{ fontSize: '0.72rem', color: '#64748b' }}>Détection du contenu et extraction des données CRA</div>
          </div>
        </div>
      )}

      {analysisResult && (
        <div style={{ ...card, padding: '1.25rem', marginBottom: '1.5rem', borderLeft: '4px solid #34d399' }}>
          <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#34d399', marginBottom: '0.75rem', textTransform: 'uppercase' }}>🤖 Résultat de l'analyse</div>
          {analysisResult.categorie_detectee && (
            <div style={{ fontSize: '0.85rem', color: '#e2e8f0', marginBottom: '0.5rem' }}>
              📋 Catégorie détectée : <strong style={{ color: '#D4AF37' }}>{CATEGORIES[analysisResult.categorie_detectee]?.label || analysisResult.categorie_detectee}</strong>
            </div>
          )}
          {analysisResult.description && (
            <div style={{ fontSize: '0.82rem', color: '#94a3b8', marginBottom: '0.5rem', lineHeight: 1.5 }}>{analysisResult.description}</div>
          )}
          {analysisResult.cra_data && (
            <div style={{ marginTop: '0.75rem' }}>
              <div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#60a5fa', marginBottom: '0.4rem' }}>📅 Données CRA détectées :</div>
              <div style={{ background: 'rgba(0,0,0,0.2)', borderRadius: '8px', padding: '0.75rem', fontSize: '0.78rem', color: '#e2e8f0' }}>
                {analysisResult.cra_data.mois && <div>Mois : <strong>{analysisResult.cra_data.mois}/{analysisResult.cra_data.annee}</strong></div>}
                {analysisResult.cra_data.jours_travailles != null && <div>Jours travaillés : <strong style={{ color: '#34d399' }}>{analysisResult.cra_data.jours_travailles}</strong></div>}
                {analysisResult.cra_data.jours_absence != null && <div>Jours absence : <strong style={{ color: '#f59e0b' }}>{analysisResult.cra_data.jours_absence}</strong></div>}
                {analysisResult.cra_data.client && <div>Client : <strong>{analysisResult.cra_data.client}</strong></div>}
              </div>
              {!analysisResult.applied && (
                <button onClick={applyCRAData} style={{ marginTop: '0.75rem', width: '100%', padding: '0.6rem', borderRadius: '8px', background: 'linear-gradient(135deg, #D4AF37, #c9a02e)', border: 'none', color: '#0f172a', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer' }}>📅 Appliquer au CRA du mois</button>
              )}
              {analysisResult.applied && (
                <div style={{ marginTop: '0.5rem', textAlign: 'center', color: '#34d399', fontSize: '0.82rem', fontWeight: 600 }}>✅ Données appliquées au CRA</div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Documents list */}
      <div style={{ ...card, padding: '1.25rem' }}>
        <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#94a3b8', marginBottom: '0.75rem', textTransform: 'uppercase' }}>Mes fichiers</div>
        {documents.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#475569', padding: '2rem', fontSize: '0.85rem' }}>Aucun document uploadé</div>
        ) : documents.map(doc => {
          const cat = CATEGORIES[doc.categorie] || CATEGORIES.autre
          const hasCRA = !!doc.cra_data
          return (
            <div key={doc.id} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem',
              borderRadius: '10px', marginBottom: '0.4rem', background: 'rgba(255,255,255,0.02)',
              border: hasCRA ? '1px solid rgba(212,175,55,0.2)' : '1px solid rgba(255,255,255,0.04)',
              cursor: 'pointer'
            }} onClick={() => setSelectedDoc(selectedDoc?.id === doc.id ? null : doc)}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flex: 1 }}>
                <span style={{ fontSize: '1.3rem' }}>{cat.icon}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#e2e8f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doc.nom_fichier}</div>
                  <div style={{ fontSize: '0.68rem', color: '#64748b' }}>
                    {cat.label} · {formatSize(doc.taille)} · {new Date(doc.created_at).toLocaleDateString('fr-FR')}
                    {hasCRA && <span style={{ color: '#D4AF37', marginLeft: '0.5rem' }}>📅 CRA détecté</span>}
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.3rem' }} onClick={e => e.stopPropagation()}>
                {hasCRA && (
                  <button onClick={() => { setAnalysisResult({ cra_data: doc.cra_data }); }} style={{ background: 'rgba(212,175,55,0.1)', border: '1px solid rgba(212,175,55,0.2)', color: '#D4AF37', padding: '0.25rem 0.5rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.68rem', fontWeight: 600 }}>📅 CRA</button>
                )}
                <button onClick={() => downloadDocument(doc)} style={{ background: 'rgba(96,165,250,0.1)', border: '1px solid rgba(96,165,250,0.2)', color: '#60a5fa', padding: '0.25rem 0.5rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.68rem' }}>⬇️</button>
                <button onClick={() => deleteDocument(doc)} style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.2)', color: '#f87171', padding: '0.25rem 0.5rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.68rem' }}>🗑️</button>
              </div>
            </div>
          )
        })}
      </div>

      <style>{'@keyframes spin { to { transform: rotate(360deg) } }'}</style>
    </div>
  )
}

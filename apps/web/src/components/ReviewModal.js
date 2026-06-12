'use client';
import { useState } from 'react';
import { toast } from 'react-hot-toast';
import { supabase } from '@parkings/supabase-db';

export default function ReviewModal({ reservaId, onClose, onSubmit, initialStars = 0, initialComentario = '' }) {
  const esEdicion = initialStars > 0;
  const [stars, setStars] = useState(initialStars);
  const [hovered, setHovered] = useState(0);
  const [comentario, setComentario] = useState(initialComentario);
  const [loading, setLoading] = useState(false);
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const handleSubmit = async () => {
    if (stars === 0) {
      toast.error('Selecciona una puntuación antes de enviar.');
      return;
    }
    setLoading(true);
    try {
      let photoUrl = null;
      if (photoFile) {
        setUploadingPhoto(true);
        const ext = photoFile.name.split('.').pop();
        const path = `${reservaId}/${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage.from('review-photos').upload(path, photoFile, { upsert: true });
        if (!upErr) {
          const { data: { publicUrl } } = supabase.storage.from('review-photos').getPublicUrl(path);
          photoUrl = publicUrl;
        }
        setUploadingPhoto(false);
      }
      await onSubmit({ reservaId, stars, comentario: comentario.trim() || null, photoUrl });
      toast.success('¡Gracias por tu calificación!');
      onClose();
    } catch (err) {
      toast.error(err.message || 'No se pudo enviar la calificación.');
    } finally {
      setLoading(false);
    }
  };

  const displayStars = hovered || stars;

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(2,6,23,0.85)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '16px' }}
      onClick={(e) => e.target === e.currentTarget && !loading && onClose()}
    >
      <div
        style={{ background: 'linear-gradient(145deg,#0f172a,#1e293b)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '24px', padding: '32px', width: '100%', maxWidth: '400px', boxShadow: '0 0 60px rgba(59,130,246,0.1)' }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="review-modal-title"
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <div>
            <h3 id="review-modal-title" style={{ color: '#f8fafc', fontWeight: 800, fontSize: '1.15rem', margin: 0 }}>
              <i className="fa-solid fa-star" style={{ color: '#f59e0b', marginRight: '8px' }}></i>
              {esEdicion ? 'Edita tu reseña' : 'Califica tu experiencia'}
            </h3>
            <p style={{ color: '#64748b', fontSize: '0.82rem', marginTop: '4px' }}>Tu opinión ayuda a mejorar la comunidad</p>
          </div>
          <button
            onClick={onClose}
            disabled={loading}
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', color: '#94a3b8', cursor: 'pointer', padding: '8px 10px' }}
            aria-label="Cerrar"
          >
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

        {/* Stars */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', marginBottom: '8px' }}>
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              onClick={() => setStars(n)}
              onMouseEnter={() => setHovered(n)}
              onMouseLeave={() => setHovered(0)}
              disabled={loading}
              style={{ background: 'none', border: 'none', cursor: loading ? 'not-allowed' : 'pointer', fontSize: '2.2rem', color: n <= displayStars ? '#f59e0b' : '#334155', transition: 'color 0.1s, transform 0.1s', transform: n <= displayStars ? 'scale(1.15)' : 'scale(1)', padding: '4px' }}
              aria-label={`${n} estrella${n > 1 ? 's' : ''}`}
            >
              ★
            </button>
          ))}
        </div>

        {/* Stars label */}
        <div style={{ textAlign: 'center', marginBottom: '20px', minHeight: '22px' }}>
          {displayStars > 0 && (
            <span style={{ color: '#f59e0b', fontWeight: 700, fontSize: '0.9rem' }}>
              {['', 'Muy malo', 'Malo', 'Regular', 'Bueno', '¡Excelente!'][displayStars]}
            </span>
          )}
          {displayStars === 0 && (
            <span style={{ color: '#475569', fontSize: '0.85rem' }}>Toca para puntuar</span>
          )}
        </div>

        {/* Comment */}
        <label style={{ color: '#94a3b8', fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: '8px' }}>
          Comentario <span style={{ color: '#475569', fontWeight: 400 }}>(opcional)</span>
        </label>
        <textarea
          value={comentario}
          onChange={(e) => setComentario(e.target.value)}
          placeholder="Cuéntanos cómo fue tu experiencia…"
          maxLength={500}
          disabled={loading}
          style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', color: '#e2e8f0', padding: '12px 14px', fontSize: '0.9rem', resize: 'vertical', minHeight: '88px', boxSizing: 'border-box', outline: 'none', fontFamily: 'inherit' }}
        />
        <div style={{ textAlign: 'right', color: '#475569', fontSize: '0.75rem', marginTop: '4px', marginBottom: '0' }}>
          {comentario.length}/500
        </div>

        {/* Photo upload */}
        <label style={{color:'#94a3b8',fontSize:'0.85rem',fontWeight:600,display:'block',marginBottom:'8px',marginTop:'12px'}}>
          Foto <span style={{color:'#475569',fontWeight:400}}>(opcional)</span>
        </label>
        {photoPreview ? (
          <div style={{position:'relative',marginBottom:'16px'}}>
            <img src={photoPreview} alt="preview" style={{width:'100%',maxHeight:'160px',objectFit:'cover',borderRadius:'12px',border:'1px solid rgba(255,255,255,0.08)'}} />
            <button onClick={()=>{setPhotoFile(null);setPhotoPreview(null);}} style={{position:'absolute',top:'8px',right:'8px',background:'rgba(0,0,0,0.7)',border:'none',color:'white',borderRadius:'50%',width:'28px',height:'28px',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}} aria-label="Quitar foto">
              <i className="fa-solid fa-xmark"></i>
            </button>
          </div>
        ) : (
          <label style={{display:'flex',alignItems:'center',gap:'10px',padding:'14px',background:'rgba(255,255,255,0.03)',border:'1px dashed rgba(255,255,255,0.12)',borderRadius:'12px',cursor:'pointer',color:'#64748b',fontSize:'0.85rem',marginBottom:'16px'}}>
            <i className="fa-solid fa-camera" style={{fontSize:'1.2rem',color:'#3b82f6'}}></i>
            Añadir foto a la reseña
            <input type="file" accept="image/*" style={{display:'none'}} onChange={e => {
              const f = e.target.files?.[0];
              if (!f) return;
              setPhotoFile(f);
              setPhotoPreview(URL.createObjectURL(f));
            }} />
          </label>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={onClose}
            disabled={loading}
            style={{ flex: 1, padding: '12px', border: '1px solid rgba(255,255,255,0.08)', background: 'transparent', color: '#94a3b8', borderRadius: '12px', cursor: loading ? 'not-allowed' : 'pointer', fontWeight: 700, fontSize: '0.9rem' }}
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading || stars === 0}
            style={{ flex: 2, padding: '12px', background: stars > 0 && !loading ? 'linear-gradient(135deg,#f59e0b,#d97706)' : 'rgba(255,255,255,0.05)', border: 'none', borderRadius: '12px', color: stars > 0 && !loading ? 'white' : '#475569', cursor: loading || stars === 0 ? 'not-allowed' : 'pointer', fontWeight: 800, fontSize: '0.95rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', transition: 'all 0.2s' }}
          >
            {uploadingPhoto ? (
              <><i className="fa-solid fa-circle-notch fa-spin"></i> Subiendo foto...</>
            ) : loading ? (
              <><i className="fa-solid fa-circle-notch fa-spin"></i> Enviando…</>
            ) : (
              <><i className="fa-solid fa-paper-plane"></i> Enviar reseña</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

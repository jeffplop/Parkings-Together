'use client';
import { useState, useRef, useEffect } from 'react';

const BOT_NAME = 'Dareko IA';

const QUICK_QUESTIONS = [
  '¿Cómo reservo un estacionamiento?',
  '¿Cuáles son los planes Premium?',
  '¿Cómo publico mi estacionamiento?',
  '¿Cómo cancelo una reserva?',
];

// Renderiza un subconjunto mínimo de Markdown (negrita y saltos de línea) a HTML.
// SEGURIDAD: escapa primero las entidades HTML para evitar XSS — el texto puede
// venir del usuario o de la respuesta de la IA, así que jamás debe interpretarse
// como HTML crudo. Tras escapar, solo se reintroducen <strong> y <br/> seguros.
function renderMarkdown(text) {
  const escaped = String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  return escaped
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br/>');
}

export default function SupportChat() {
  const [open, setOpen]     = useState(false);
  const [msgs, setMsgs]     = useState([
    { role: 'assistant', text: '¡Hola! 👋 Soy **Dareko**, tu asistente de Parkings Together. ¿En qué te puedo ayudar?', time: new Date() },
  ]);
  const [input, setInput]   = useState('');
  const [loading, setLoading] = useState(false);
  const [unread, setUnread] = useState(0);
  const bottomRef           = useRef(null);
  const inputRef            = useRef(null);

  useEffect(() => {
    if (open) { setUnread(0); setTimeout(() => inputRef.current?.focus(), 100); }
  }, [open]);

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [msgs, open]);

  const sendMessage = async (text) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    const userMsg = { role: 'user', text: trimmed, time: new Date() };
    const newMsgs = [...msgs, userMsg];
    setMsgs(newMsgs);
    setInput('');
    setLoading(true);

    try {
      // Build API-compatible history (exclude initial greeting from history)
      const history = newMsgs
        .filter(m => !(m.role === 'assistant' && newMsgs.indexOf(m) === 0))
        .map(m => ({ role: m.role, content: m.text }));

      const res = await fetch('/api/support/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history }),
      });

      const data = await res.json();
      const replyText = data.reply || 'No pude procesar tu consulta. Por favor intenta de nuevo.';

      setMsgs(prev => [...prev, { role: 'assistant', text: replyText, time: new Date() }]);
      if (!open) setUnread(u => u + 1);
    } catch {
      setMsgs(prev => [...prev, {
        role: 'assistant',
        text: 'Hubo un problema de conexión. Por favor intenta de nuevo o escríbenos a **soporte@parkingstogether.cl**',
        time: new Date(),
      }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(input); }
  };

  return (
    <>
      {/* FAB */}
      <button className="chat-fab" onClick={() => setOpen(v => !v)} aria-label="Abrir chat de soporte">
        <i className={`fa-solid ${open ? 'fa-xmark' : 'fa-headset'}`}></i>
        {!open && unread > 0 && <span className="chat-badge">{unread}</span>}
      </button>

      {/* CHAT WINDOW */}
      {open && (
        <div className="chat-window" role="dialog" aria-label="Chat de soporte Dareko IA">
          {/* Header */}
          <div className="chat-header">
            <div className="chat-avatar"><i className="fa-solid fa-robot"></i></div>
            <div className="chat-header-info">
              <strong>{BOT_NAME}</strong>
              <span className="chat-status"><span className="dot"></span> En línea · IA</span>
            </div>
            <button className="chat-close" onClick={() => setOpen(false)} aria-label="Cerrar chat">
              <i className="fa-solid fa-xmark"></i>
            </button>
          </div>

          {/* Messages */}
          <div className="chat-messages">
            {msgs.map((m, i) => (
              <div key={i} className={`chat-msg ${m.role === 'user' ? 'user' : 'bot'}`}>
                {m.role !== 'user' && <div className="msg-avatar"><i className="fa-solid fa-robot"></i></div>}
                <div className="msg-bubble" dangerouslySetInnerHTML={{ __html: renderMarkdown(m.text) }} />
              </div>
            ))}
            {loading && (
              <div className="chat-msg bot">
                <div className="msg-avatar"><i className="fa-solid fa-robot"></i></div>
                <div className="msg-bubble typing"><span></span><span></span><span></span></div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Quick questions (only shown at start) */}
          {msgs.length <= 2 && !loading && (
            <div className="chat-quick">
              {QUICK_QUESTIONS.map((q, i) => (
                <button key={i} className="quick-btn" onClick={() => sendMessage(q)}>{q}</button>
              ))}
            </div>
          )}

          {/* Input */}
          <div className="chat-input-row">
            <input
              ref={inputRef}
              type="text"
              placeholder="Escribe tu pregunta..."
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKey}
              maxLength={500}
              disabled={loading}
              aria-label="Mensaje para Dareko"
            />
            <button
              className="send-btn"
              onClick={() => sendMessage(input)}
              disabled={!input.trim() || loading}
              aria-label="Enviar mensaje"
            >
              {loading
                ? <i className="fa-solid fa-circle-notch fa-spin"></i>
                : <i className="fa-solid fa-paper-plane"></i>
              }
            </button>
          </div>
        </div>
      )}

      <style jsx>{`
        .chat-fab {
          position: fixed;
          bottom: 28px;
          right: 28px;
          z-index: 9999;
          width: 56px;
          height: 56px;
          border-radius: 50%;
          background: linear-gradient(135deg, #2563eb, #10b981);
          border: none;
          color: white;
          font-size: 1.3rem;
          cursor: pointer;
          box-shadow: 0 8px 24px rgba(37,99,235,0.4);
          transition: transform 0.2s, box-shadow 0.2s;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .chat-fab:hover { transform: scale(1.08); box-shadow: 0 12px 32px rgba(37,99,235,0.5); }
        .chat-badge {
          position: absolute;
          top: -4px;
          right: -4px;
          background: #ef4444;
          color: white;
          font-size: 0.65rem;
          font-weight: 800;
          width: 18px;
          height: 18px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 2px solid #020617;
        }

        .chat-window {
          position: fixed;
          bottom: 96px;
          right: 28px;
          z-index: 9998;
          width: 360px;
          max-height: 540px;
          background: #0f172a;
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 20px;
          box-shadow: 0 24px 60px rgba(0,0,0,0.6);
          display: flex;
          flex-direction: column;
          overflow: hidden;
          animation: chatIn 0.25s cubic-bezier(0.175,0.885,0.32,1.275) both;
        }
        @keyframes chatIn {
          from { opacity: 0; transform: scale(0.9) translateY(16px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }

        .chat-header {
          background: linear-gradient(135deg, #1e3a5f, #0f2942);
          padding: 14px 16px;
          display: flex;
          align-items: center;
          gap: 12px;
          border-bottom: 1px solid rgba(255,255,255,0.08);
          flex-shrink: 0;
        }
        .chat-avatar {
          width: 38px;
          height: 38px;
          border-radius: 50%;
          background: linear-gradient(135deg,#2563eb,#10b981);
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-size: 1rem;
          flex-shrink: 0;
        }
        .chat-header-info { flex: 1; }
        .chat-header-info strong { display: block; color: white; font-size: 0.95rem; }
        .chat-status { font-size: 0.72rem; color: #64748b; display: flex; align-items: center; gap: 5px; margin-top: 2px; }
        .dot { width: 7px; height: 7px; border-radius: 50%; background: #10b981; display: inline-block; animation: blink 2s infinite; }
        @keyframes blink { 0%,100% { opacity:1; } 50% { opacity:0.4; } }
        .chat-close { background: none; border: none; color: #64748b; cursor: pointer; font-size: 1rem; padding: 4px; border-radius: 6px; transition: color 0.2s; }
        .chat-close:hover { color: white; }

        .chat-messages {
          flex: 1;
          overflow-y: auto;
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 12px;
          scrollbar-width: thin;
          scrollbar-color: #1e293b transparent;
        }
        .chat-msg { display: flex; gap: 8px; align-items: flex-end; }
        .chat-msg.user { flex-direction: row-reverse; }
        .msg-avatar {
          width: 28px;
          height: 28px;
          border-radius: 50%;
          background: linear-gradient(135deg,#2563eb,#10b981);
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-size: 0.7rem;
          flex-shrink: 0;
        }
        .msg-bubble {
          max-width: 75%;
          padding: 10px 14px;
          border-radius: 16px;
          font-size: 0.85rem;
          line-height: 1.5;
          color: #e2e8f0;
        }
        .chat-msg.bot .msg-bubble {
          background: rgba(30,42,64,0.9);
          border: 1px solid rgba(255,255,255,0.07);
          border-bottom-left-radius: 4px;
        }
        .chat-msg.user .msg-bubble {
          background: linear-gradient(135deg,#2563eb,#1d4ed8);
          border-bottom-right-radius: 4px;
          color: white;
        }
        .msg-bubble.typing { display: flex; gap: 5px; align-items: center; padding: 12px 16px; }
        .msg-bubble.typing span {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: #64748b;
          animation: bounce 1.2s infinite;
        }
        .msg-bubble.typing span:nth-child(2) { animation-delay: 0.15s; }
        .msg-bubble.typing span:nth-child(3) { animation-delay: 0.3s; }
        @keyframes bounce {
          0%,80%,100% { transform: translateY(0); }
          40% { transform: translateY(-6px); }
        }

        .chat-quick {
          padding: 0 16px 12px;
          display: flex;
          flex-direction: column;
          gap: 6px;
          flex-shrink: 0;
        }
        .quick-btn {
          background: rgba(37,99,235,0.1);
          border: 1px solid rgba(37,99,235,0.3);
          color: #93c5fd;
          border-radius: 10px;
          padding: 8px 12px;
          font-size: 0.78rem;
          text-align: left;
          cursor: pointer;
          transition: all 0.15s;
          font-weight: 500;
        }
        .quick-btn:hover { background: rgba(37,99,235,0.2); border-color: #3b82f6; color: white; }

        .chat-input-row {
          display: flex;
          gap: 8px;
          padding: 12px 14px;
          border-top: 1px solid rgba(255,255,255,0.07);
          flex-shrink: 0;
          background: rgba(15,23,42,0.8);
        }
        .chat-input-row input {
          flex: 1;
          background: rgba(0,0,0,0.4);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 12px;
          padding: 10px 14px;
          color: white;
          font-size: 0.85rem;
          outline: none;
          transition: border-color 0.2s;
        }
        .chat-input-row input:focus { border-color: #3b82f6; }
        .chat-input-row input::placeholder { color: #475569; }
        .chat-input-row input:disabled { opacity: 0.6; cursor: not-allowed; }
        .send-btn {
          width: 40px;
          height: 40px;
          border-radius: 12px;
          background: linear-gradient(135deg,#2563eb,#10b981);
          border: none;
          color: white;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 0.9rem;
          transition: opacity 0.2s, transform 0.15s;
          flex-shrink: 0;
        }
        .send-btn:disabled { opacity: 0.4; cursor: not-allowed; }
        .send-btn:not(:disabled):hover { transform: scale(1.05); }

        @media (max-width: 480px) {
          .chat-window { right: 12px; left: 12px; width: auto; bottom: 84px; }
          .chat-fab { bottom: 20px; right: 20px; }
        }
      `}</style>
    </>
  );
}

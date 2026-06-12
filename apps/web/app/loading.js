'use client';
export default function Loading() {
  return (
    <div className="cyber-loader-container">
      <div className="cyber-grid-bg"></div>
      
      <div className="loader-content">
        <div className="radar-spinner">
          <div className="circle inner"></div>
          <div className="circle middle"></div>
          <div className="circle outer"></div>
          <div className="scanner-line"></div>
        </div>
        <h2 className="loading-text">
          Cargando<span>.</span><span>.</span><span>.</span>
        </h2>
        <div className="progress-bar-container">
          <div className="progress-bar-fill"></div>
        </div>
      </div>

      <style jsx>{`
        .cyber-loader-container {
          min-height: 100vh;
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
          background-color: #020617; /* Slate 950 */
          overflow: hidden;
          z-index: 9999;
        }

        .cyber-grid-bg {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background-image: radial-gradient(rgba(59, 130, 246, 0.2) 1px, transparent 1px);
          background-size: 40px 40px;
          z-index: 1;
          opacity: 0.6;
        }

        .loader-content {
          position: relative;
          z-index: 2;
          display: flex;
          flex-direction: column;
          align-items: center;
          animation: fadeIn 0.5s ease-out;
        }

        /* Radar Spinner */
        .radar-spinner {
          position: relative;
          width: 120px;
          height: 120px;
          margin-bottom: 30px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .circle {
          position: absolute;
          border-radius: 50%;
          border: 1px solid rgba(59, 130, 246, 0.2);
        }

        .circle.inner {
          width: 30px;
          height: 30px;
          background: rgba(59, 130, 246, 0.4);
          box-shadow: 0 0 15px rgba(59, 130, 246, 0.8);
          animation: pulse 1.5s ease-in-out infinite alternate;
        }

        .circle.middle {
          width: 70px;
          height: 70px;
          border-color: rgba(59, 130, 246, 0.4);
        }

        .circle.outer {
          width: 120px;
          height: 120px;
          border-color: rgba(59, 130, 246, 0.6);
          box-shadow: inset 0 0 20px rgba(59, 130, 246, 0.1);
        }

        .scanner-line {
          position: absolute;
          width: 60px; /* half of outer */
          height: 60px;
          background: conic-gradient(from 0deg, rgba(59, 130, 246, 0.8) 0deg, transparent 60deg);
          top: 0;
          left: 50%;
          transform-origin: bottom left;
          border-radius: 100% 0 0 0;
          animation: rotate 2s linear infinite;
        }

        /* Text styling */
        .loading-text {
          font-family: 'Inter', sans-serif;
          font-size: 1.2rem;
          font-weight: 700;
          color: #e2e8f0;
          letter-spacing: 2px;
          margin-bottom: 20px;
          text-transform: uppercase;
        }

        .loading-text span {
          animation: blink 1.4s infinite both;
        }
        .loading-text span:nth-child(2) { animation-delay: 0.2s; }
        .loading-text span:nth-child(3) { animation-delay: 0.4s; }

        /* Progress Bar */
        .progress-bar-container {
          width: 200px;
          height: 4px;
          background: rgba(15, 23, 42, 0.8);
          border-radius: 4px;
          overflow: hidden;
          position: relative;
          border: 1px solid rgba(59, 130, 246, 0.3);
        }

        .progress-bar-fill {
          height: 100%;
          background: linear-gradient(90deg, #3b82f6, #8b5cf6);
          width: 50%;
          border-radius: 4px;
          animation: loadProgress 2s ease-in-out infinite;
        }

        @keyframes rotate {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        @keyframes pulse {
          0% { transform: scale(0.8); opacity: 0.5; }
          100% { transform: scale(1.2); opacity: 1; }
        }

        @keyframes blink {
          0% { opacity: 0.2; }
          20% { opacity: 1; }
          100% { opacity: 0.2; }
        }

        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @keyframes loadProgress {
          0% { width: 0%; left: 0; position: absolute; }
          50% { width: 100%; left: 0; position: absolute; }
          50.001% { width: 100%; right: 0; position: absolute; left: auto; }
          100% { width: 0%; right: 0; position: absolute; left: auto; }
        }
      `}</style>
    </div>
  );
}

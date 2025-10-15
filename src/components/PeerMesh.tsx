import { useEffect, useRef, useState } from 'react';
import { formatMetricsSummary, type GenerationMetrics } from '../lib/metrics';

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
};

type MeshLogEntry =
  | {
      id: string;
      type: 'chat';
      author: 'self' | 'peer';
      text: string;
    }
  | {
      id: string;
      type: 'metrics';
      author: 'self' | 'peer';
      metrics: GenerationMetrics;
    };

interface PeerMeshProps {
  latestMetrics: GenerationMetrics | null;
  onMetricsReceived?: (metrics: GenerationMetrics) => void;
}

export default function PeerMesh({ latestMetrics, onMetricsReceived }: PeerMeshProps) {
  const [connectionState, setConnectionState] = useState<RTCPeerConnectionState>('new');
  const [localOffer, setLocalOffer] = useState('');
  const [remoteOffer, setRemoteOffer] = useState('');
  const [localAnswer, setLocalAnswer] = useState('');
  const [remoteAnswer, setRemoteAnswer] = useState('');
  const [channelReady, setChannelReady] = useState(false);
  const [draft, setDraft] = useState('');
  const [messages, setMessages] = useState<MeshLogEntry[]>([]);
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const channelRef = useRef<RTCDataChannel | null>(null);
  const lastSentMetricId = useRef<string | null>(null);
  const metricsHandlerRef = useRef(onMetricsReceived);

  useEffect(() => {
    metricsHandlerRef.current = onMetricsReceived;
  }, [onMetricsReceived]);

  useEffect(() => {
    const peer = new RTCPeerConnection(ICE_SERVERS);
    peerRef.current = peer;

    function configureChannel(channel: RTCDataChannel) {
      channel.binaryType = 'arraybuffer';
      channel.onopen = () => setChannelReady(true);
      channel.onclose = () => setChannelReady(false);
      channel.onmessage = (event) => {
        const raw = String(event.data);
        try {
          const parsed = JSON.parse(raw) as { type?: string; text?: string; id?: string; metrics?: GenerationMetrics };
          if (parsed?.type === 'metrics' && parsed.metrics) {
            const incoming: GenerationMetrics = {
              ...parsed.metrics,
              source: 'peer'
            };
            setMessages((prev) => [
              ...prev,
              { id: incoming.id, type: 'metrics', author: 'peer', metrics: incoming }
            ]);
            metricsHandlerRef.current?.(incoming);
            return;
          }
          if (parsed?.type === 'chat') {
            const text = typeof parsed.text === 'string' ? parsed.text.trim() : '';
            if (!text) {
              return;
            }
            setMessages((prev) => [
              ...prev,
              {
                id: parsed.id ?? crypto.randomUUID(),
                type: 'chat',
                author: 'peer',
                text
              }
            ]);
            return;
          }
        } catch (error) {
          console.warn('Failed to parse peer payload', error);
        }

        setMessages((prev) => [
          ...prev,
          { id: crypto.randomUUID(), type: 'chat', author: 'peer', text: raw }
        ]);
      };
      channelRef.current = channel;
    }

    const localChannel = peer.createDataChannel('imagination-channel');
    configureChannel(localChannel);

    peer.ondatachannel = (event) => {
      configureChannel(event.channel);
    };

    peer.onconnectionstatechange = () => {
      setConnectionState(peer.connectionState);
      if (peer.connectionState === 'failed') {
        setChannelReady(false);
      }
    };

    peer.onicecandidate = (event) => {
      if (event.candidate) {
        return;
      }
      setLocalOffer(JSON.stringify(peer.localDescription));
    };

    return () => {
      localChannel.close();
      peer.close();
    };
  }, []);

  async function createOffer() {
    const peer = peerRef.current;
    if (!peer) {
      return;
    }
    const offer = await peer.createOffer();
    await peer.setLocalDescription(offer);
  }

  async function collapseRemoteOffer() {
    const peer = peerRef.current;
    if (!peer || !remoteOffer.trim()) {
      return;
    }
    const remoteDescription = new RTCSessionDescription(JSON.parse(remoteOffer));
    await peer.setRemoteDescription(remoteDescription);
    const answer = await peer.createAnswer();
    await peer.setLocalDescription(answer);
    setLocalAnswer(JSON.stringify(peer.localDescription));
  }

  async function bindRemoteAnswer() {
    const peer = peerRef.current;
    if (!peer || !remoteAnswer.trim()) {
      return;
    }
    const remoteDescription = new RTCSessionDescription(JSON.parse(remoteAnswer));
    await peer.setRemoteDescription(remoteDescription);
  }

  function sendMessage() {
    if (!channelRef.current || !draft.trim()) {
      return;
    }
    const payload = {
      type: 'chat' as const,
      id: crypto.randomUUID(),
      text: draft.trim()
    };
    channelRef.current.send(JSON.stringify(payload));
    setMessages((prev) => [
      ...prev,
      { id: payload.id, type: 'chat', author: 'self', text: payload.text }
    ]);
    setDraft('');
  }

  useEffect(() => {
    if (!latestMetrics || !channelReady || !channelRef.current) {
      return;
    }
    if (lastSentMetricId.current === latestMetrics.id) {
      return;
    }

    const payload = {
      type: 'metrics' as const,
      metrics: latestMetrics
    };

    try {
      channelRef.current.send(JSON.stringify(payload));
      setMessages((prev) => [
        ...prev,
        { id: latestMetrics.id, type: 'metrics', author: 'self', metrics: latestMetrics }
      ]);
      lastSentMetricId.current = latestMetrics.id;
    } catch (error) {
      console.warn('Failed to share metrics across the mesh', error);
    }
  }, [channelReady, latestMetrics]);

  return (
    <section className="panel">
      <header className="panel__header">
        <div>
          <h2 className="panel__title">WebRTC Dream Node Link</h2>
          <p className="panel__subtitle">
            Connect peers via peer-to-peer WebRTC data channels. Exchange the session descriptions manually to entangle remote imagination nodes without centralized storage.
          </p>
        </div>
      </header>

      <div className="mesh">
        <div className="mesh__column">
          <h3>1. Emit Offer</h3>
          <p className="mesh__hint">Generate and share your SDP blob with another explorer.</p>
          <button className="primary" type="button" onClick={createOffer}>
            Create Offer
          </button>
          <textarea
            value={localOffer}
            onChange={(event) => setLocalOffer(event.target.value)}
            placeholder="Offer SDP will appear here."
            rows={6}
          />
        </div>
        <div className="mesh__column">
          <h3>2. Collapse Partner Offer</h3>
          <p className="mesh__hint">Paste an incoming offer, collapse it into an answer, and return it.</p>
          <textarea
            value={remoteOffer}
            onChange={(event) => setRemoteOffer(event.target.value)}
            placeholder="Paste remote offer SDP here."
            rows={4}
          />
          <button className="ghost" type="button" onClick={collapseRemoteOffer}>
            Collapse Offer → Generate Answer
          </button>
          <textarea
            value={localAnswer}
            onChange={(event) => setLocalAnswer(event.target.value)}
            placeholder="Share this generated answer back to the originator."
            rows={4}
          />
          <textarea
            value={remoteAnswer}
            onChange={(event) => setRemoteAnswer(event.target.value)}
            placeholder="Paste remote answer SDP to complete the handshake."
            rows={4}
          />
          <button className="primary" type="button" onClick={bindRemoteAnswer}>
            Bind Remote Answer
          </button>
        </div>
      </div>

      <footer className="mesh__footer">
        <p>
          Connection state: <span className={`badge badge--${connectionState}`}>{connectionState}</span>
        </p>
        <div className="mesh__chat">
          <div className="mesh__chat-log">
            {messages.length === 0 ? <p className="console__empty">Awaiting peer transmissions.</p> : null}
            {messages.map((message) => (
              <div key={message.id} className={`mesh__message mesh__message--${message.author}`}>
                {message.type === 'chat' ? (
                  <p className="mesh__message-text">{message.text}</p>
                ) : (
                  <p className="mesh__message-text">
                    ⚡ Metrics Sync → {formatMetricsSummary(message.metrics)}
                  </p>
                )}
              </div>
            ))}
          </div>
          <div className="mesh__composer">
            <textarea
              rows={2}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Share data, prompts, or states across the mesh."
              disabled={!channelReady}
            />
            <button className="primary" type="button" onClick={sendMessage} disabled={!channelReady}>
              Send
            </button>
          </div>
        </div>
      </footer>
    </section>
  );
}

import { useEffect, useRef, useState } from 'react';

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
};

interface PeerMessage {
  id: string;
  author: 'self' | 'peer';
  text: string;
}

export default function PeerMesh() {
  const [connectionState, setConnectionState] = useState<RTCPeerConnectionState>('new');
  const [localOffer, setLocalOffer] = useState('');
  const [remoteOffer, setRemoteOffer] = useState('');
  const [localAnswer, setLocalAnswer] = useState('');
  const [remoteAnswer, setRemoteAnswer] = useState('');
  const [channelReady, setChannelReady] = useState(false);
  const [draft, setDraft] = useState('');
  const [messages, setMessages] = useState<PeerMessage[]>([]);
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const channelRef = useRef<RTCDataChannel | null>(null);

  useEffect(() => {
    const peer = new RTCPeerConnection(ICE_SERVERS);
    peerRef.current = peer;

    function configureChannel(channel: RTCDataChannel) {
      channel.binaryType = 'arraybuffer';
      channel.onopen = () => setChannelReady(true);
      channel.onclose = () => setChannelReady(false);
      channel.onmessage = (event) =>
        setMessages((prev) => [
          ...prev,
          { id: crypto.randomUUID(), author: 'peer', text: String(event.data) }
        ]);
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
    channelRef.current.send(draft.trim());
    setMessages((prev) => [
      ...prev,
      { id: crypto.randomUUID(), author: 'self', text: draft.trim() }
    ]);
    setDraft('');
  }

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
              <p key={message.id} className={`mesh__message mesh__message--${message.author}`}>
                {message.text}
              </p>
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

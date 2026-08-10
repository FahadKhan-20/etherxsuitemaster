import { useState } from 'react';
import { motion } from 'framer-motion';
import { Bot, CalendarClock, Hand, MessageSquare, Mic, MicOff, MoreVertical, Palette, PhoneOff, ScreenShare, Shield, Video, VideoOff, WandSparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useMeeting } from '../../context/MeetingContext';
import Dropdown from '../ui/Dropdown';

export default function BottomBar({ isInMeeting, onAction }) {
  const navigate = useNavigate();
  const { currentUser, toggleMute, toggleVideo, toggleHand, toggleChat, leaveMeeting } = useMeeting();
  const [isScreenSharing, setIsScreenSharing] = useState(false);

  if (!isInMeeting) {
    return null;
  }

  const moreItems = [
    { label: 'AI Assistant', icon: <Bot className="h-4 w-4" />, onClick: () => onAction?.('ai') },
    { label: 'Virtual Background', icon: <Palette className="h-4 w-4" />, onClick: () => onAction?.('background') },
    { label: 'Voice Effects', icon: <WandSparkles className="h-4 w-4" />, onClick: () => onAction?.('voice') },
    { label: 'Agenda', icon: <CalendarClock className="h-4 w-4" />, onClick: () => onAction?.('agenda') },
    { label: 'Security', icon: <Shield className="h-4 w-4" />, onClick: () => onAction?.('security') },
  ];

  const handleChat = () => {
    if (window.matchMedia('(min-width: 1280px)').matches) {
      document.getElementById('etherx-chat-input')?.focus();
      return;
    }

    toggleChat();
  };

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-2 sm:bottom-4 z-40 px-2 sm:px-4">
      <motion.div
        initial={{ y: 28, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="pointer-events-auto mx-auto flex w-fit max-w-[calc(100vw-1rem)] flex-wrap items-center justify-center gap-2 sm:gap-4 rounded-[24px] sm:rounded-[30px] border border-white/10 bg-[rgba(7,10,18,0.92)] px-3 sm:px-4 py-2 sm:py-3 font-inter shadow-[0_24px_80px_rgba(1,4,14,0.7),inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-[28px]"
      >
        <div className="flex flex-wrap items-center justify-center gap-1.5 sm:gap-3">
          <DockButton
            icon={currentUser.isMuted ? <MicOff className="h-4 w-4 sm:h-5 sm:w-5" /> : <Mic className="h-4 w-4 sm:h-5 sm:w-5" />}
            label={currentUser.isMuted ? 'Unmute' : 'Mic'}
            active={!currentUser.isMuted}
            muted={currentUser.isMuted}
            onClick={toggleMute}
          />

          <DockButton
            icon={currentUser.isVideoOff ? <VideoOff className="h-4 w-4 sm:h-5 sm:w-5" /> : <Video className="h-4 w-4 sm:h-5 sm:w-5" />}
            label={currentUser.isVideoOff ? 'Off' : 'Camera'}
            active={!currentUser.isVideoOff}
            muted={currentUser.isVideoOff}
            onClick={toggleVideo}
          />

          <DockButton
            icon={<ScreenShare className="h-4 w-4 sm:h-5 sm:w-5" />}
            label="Share"
            active={isScreenSharing}
            onClick={() => {
              setIsScreenSharing((previous) => !previous);
              onAction?.('screen-share');
            }}
          />

          <DockButton
            icon={<Hand className="h-4 w-4 sm:h-5 sm:w-5" />}
            label="Hand"
            active={currentUser.isHandRaised}
            onClick={toggleHand}
          />

          <DockButton icon={<MessageSquare className="h-4 w-4 sm:h-5 sm:w-5" />} label="Chat" onClick={handleChat} />

          <Dropdown
            position="top-right"
            trigger={<DockButton icon={<MoreVertical className="h-4 w-4 sm:h-5 sm:w-5" />} label="More" />}
            items={moreItems}
          />
        </div>

        <button
          type="button"
          onClick={() => {
            leaveMeeting();
            navigate('/dashboard');
          }}
          className="flex h-10 sm:h-14 items-center gap-2 sm:gap-3 rounded-[16px] sm:rounded-[20px] border border-red-400/18 bg-red-500/14 px-3 sm:px-5 text-xs sm:text-sm font-medium text-red-100 transition-all duration-300 hover:scale-[1.01] hover:bg-red-500/20"
        >
          <PhoneOff className="h-4 w-4 sm:h-5 sm:w-5" />
          Leave
        </button>
      </motion.div>
    </div>
  );
}

function DockButton({ icon, label, onClick, active = false, muted = false }) {
  const shellClass = active
    ? 'border-[#d4af37]/28 bg-[#d4af37]/14 text-[#eedca0] shadow-[0_0_0_1px_rgba(212,175,55,0.12)]'
    : muted
      ? 'border-red-400/18 bg-red-500/10 text-red-100'
      : 'border-white/10 bg-white/[0.04] text-white/72';

  return (
    <motion.button
      whileHover={{ y: -2, scale: 1.02 }}
      whileTap={{ scale: 0.97 }}
      type="button"
      onClick={onClick}
      className="flex min-w-[50px] sm:min-w-[74px] flex-col items-center gap-1 sm:gap-2"
      title={label}
    >
      <span
        className={`flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-[14px] sm:rounded-[18px] border ${shellClass} transition-all duration-300`}
      >
        {icon}
      </span>
      <span className="text-[10px] sm:text-[11px] font-medium tracking-[0.01em] text-white/56">{label}</span>
    </motion.button>
  );
}


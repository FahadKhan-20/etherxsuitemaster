import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import mockParticipants from '../data/participants';
import { agendaTemplates } from '../data/agenda';
import { useUserContext } from './UserContext';

const INITIAL_CHAT = [
  {
    id: 'chat-1',
    sender: 'Nyla Mercer',
    text: 'Kicking off with the sprint priorities. I dropped a draft agenda in the whiteboard.',
    translated: 'Inicio con las prioridades del sprint. Dejé una agenda preliminar en la pizarra.',
    timestamp: Date.now() - 1000 * 60 * 6,
    isSelf: false,
  },
  {
    id: 'chat-2',
    sender: 'Astra Vale',
    text: 'Perfect. Let’s keep the AI notes running and timebox the decisions.',
    translated: 'Perfecto. Mantengamos las notas de IA activas y limitemos las decisiones por tiempo.',
    timestamp: Date.now() - 1000 * 60 * 4,
    isSelf: true,
  },
];

const MeetingContext = createContext(null);

const createCurrentUserParticipant = (user) => ({
  id: user.id,
  name: user.name,
  avatar: user.name
    .split(' ')
    .map((segment) => segment[0])
    .join('')
    .slice(0, 2)
    .toUpperCase(),
  role: 'Host',
  email: user.email,
  isMuted: false,
  isVideoOff: false,
  isSpeaking: false,
  isHandRaised: false,
  engagement: 92,
  speakingTime: 17,
  interruptions: 1,
  networkQuality: 'strong',
  joinedAt: new Date().toISOString(),
});

const isHostOrCoHost = (role) => role === 'Host' || role === 'Co-host';

/**
 * Coordinates room-level collaboration state, simulated real-time activity,
 * and persistent mock data for recordings, messages, and scheduled meetings.
 *
 * @param {{ children: import('react').ReactNode }} props
 */
export function MeetingProvider({ children }) {
  const { user } = useUserContext();

  const [meetingState, setMeetingState] = useState('idle');
  const [currentMeetingId, setCurrentMeetingId] = useState(null);
  const [meetingTitle, setMeetingTitle] = useState('Orbit Strategy Room');
  const [startTime, setStartTime] = useState(Date.now());
  const [currentUser, setCurrentUser] = useState(createCurrentUserParticipant(user));
  const [participants, setParticipants] = useState([
    createCurrentUserParticipant(user),
    ...mockParticipants.map((participant) => ({
      ...participant,
      isHandRaised: false,
      engagement: Math.floor(Math.random() * 24) + 62,
      speakingTime: Math.floor(Math.random() * 16) + 4,
      interruptions: Math.floor(Math.random() * 4),
      networkQuality: ['strong', 'fair', 'weak'][Math.floor(Math.random() * 3)],
    })),
  ]);
  const [chatMessages, setChatMessages] = useState(INITIAL_CHAT);
  const [reactions, setReactions] = useState([]);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isParticipantsOpen, setIsParticipantsOpen] = useState(false);
  const [recordingOptions, setRecordingOptions] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [agendaTemplate, setAgendaTemplate] = useState(agendaTemplates[0]);

  // --- Agenda topics (shared, live agenda state) ---
  const [agendaTopics, setAgendaTopics] = useState(
    agendaTemplates[0].items.map((item) => ({
      id: item.id,
      title: item.title,
      completed: false,
    })),
  );
  const [presenterId, setPresenterId] = useState(currentUser.id);


  useEffect(() => {
    const syncedCurrentUser = {
      ...createCurrentUserParticipant(user),
      isMuted: currentUser.isMuted,
      isVideoOff: currentUser.isVideoOff,
      isHandRaised: currentUser.isHandRaised,
      speakingTime: currentUser.speakingTime ?? 0,
      interruptions: currentUser.interruptions ?? 0,
      engagement: currentUser.engagement ?? 90,
      networkQuality: currentUser.networkQuality ?? 'strong',
    };

    setCurrentUser(syncedCurrentUser);
    setParticipants((previousParticipants) => {
      const everyoneElse = previousParticipants.filter((participant) => participant.id !== syncedCurrentUser.id);
      return [syncedCurrentUser, ...everyoneElse];
    });
  }, [user]);

  useEffect(() => {
    if (meetingState !== 'connected') {
      return undefined;
    }

    const speakerInterval = window.setInterval(() => {
      setParticipants((previousParticipants) => {
        const availableSpeakers = previousParticipants.filter((participant) => !participant.isMuted);
        const activeSpeaker = availableSpeakers[Math.floor(Math.random() * availableSpeakers.length)];

        return previousParticipants.map((participant) => {
          const isSpeaking = activeSpeaker?.id === participant.id;
          return {
            ...participant,
            isSpeaking,
            engagement: Math.min(
              100,
              Math.max(58, participant.engagement + (isSpeaking ? 2 : Math.random() > 0.7 ? -1 : 0)),
            ),
            speakingTime: participant.speakingTime + (isSpeaking ? 1 : 0),
            networkQuality:
              Math.random() > 0.92
                ? ['strong', 'fair', 'weak'][Math.floor(Math.random() * 3)]
                : participant.networkQuality,
          };
        });
      });
    }, 2600);

    return () => window.clearInterval(speakerInterval);
  }, [meetingState]);

  const joinMeeting = (meetingId, title) => {
    setCurrentMeetingId(meetingId);
    setMeetingState('connecting');
    setMeetingTitle(title || 'EtherXMeet Live Session');
    setStartTime(Date.now());

    window.setTimeout(() => {
      setMeetingState('connected');
    }, 700);
  };

  const leaveMeeting = () => {
    setMeetingState('disconnected');
    setCurrentMeetingId(null);
    setIsChatOpen(false);
    setIsParticipantsOpen(false);
    setReactions([]);
  };

  const toggleMute = () => {
    setCurrentUser((previousUser) => ({ ...previousUser, isMuted: !previousUser.isMuted }));
  };

  const toggleVideo = () => {
    setCurrentUser((previousUser) => ({ ...previousUser, isVideoOff: !previousUser.isVideoOff }));
  };

  const toggleHand = () => {
    setCurrentUser((previousUser) => ({ ...previousUser, isHandRaised: !previousUser.isHandRaised }));
  };

  const toggleChat = () => {
    setIsChatOpen((previousState) => {
      const nextState = !previousState;
      if (nextState) {
        setIsParticipantsOpen(false);
      }
      return nextState;
    });
  };

  const toggleParticipants = () => {
    setIsParticipantsOpen((previousState) => {
      const nextState = !previousState;
      if (nextState) {
        setIsChatOpen(false);
      }
      return nextState;
    });
  };

  const sendChatMessage = (text) => {
    if (!text.trim()) {
      return;
    }

    setChatMessages((previousMessages) => [
      ...previousMessages,
      {
        id: crypto.randomUUID(),
        sender: user.name,
        text,
        translated: `${text} [translated]`,
        timestamp: Date.now(),
        isSelf: true,
      },
    ]);
  };

  const addReaction = (emoji) => {
    const reaction = {
      id: crypto.randomUUID(),
      emoji,
      timestamp: Date.now(),
    };

    setReactions((previousReactions) => [...previousReactions, reaction]);

    window.setTimeout(() => {
      setReactions((previousReactions) =>
        previousReactions.filter((currentReaction) => currentReaction.id !== reaction.id),
      );
    }, 2800);
  };

  const startRecording = (options = {}) => {
    setRecordingOptions(options);
    setIsRecording(true);
  };

  const stopRecording = () => {
    setRecordingOptions(null);
    setIsRecording(false);
  };

  const updateParticipant = (participantId, updates) => {
    setParticipants((previousParticipants) =>
      previousParticipants.map((participant) =>
        participant.id === participantId ? { ...participant, ...updates } : participant,
      ),
    );
  };

  // --- Agenda helpers ---
  const canEditAgenda = isHostOrCoHost(currentUser.role) && meetingState !== 'connected';
  const canMarkAgendaCompleted = currentUser.id === presenterId && meetingState === 'connected';

  const addAgendaTopic = (title) => {
    if (!canEditAgenda || !title.trim()) return;

    setAgendaTopics((previousTopics) => [
      ...previousTopics,
      { id: `topic-${Date.now()}`, title: title.trim(), completed: false },
    ]);
  };

  const deleteAgendaTopic = (topicId) => {
    if (!canEditAgenda) return;

    setAgendaTopics((previousTopics) =>
      previousTopics.filter((topic) => topic.id !== topicId),
    );
  };

  const toggleAgendaTopic = (topicId) => {
    if (!canMarkAgendaCompleted) return;

    setAgendaTopics((previousTopics) =>
      previousTopics.map((topic) =>
        topic.id === topicId ? { ...topic, completed: !topic.completed } : topic,
      ),
    );
  };

  const setPresenter = (participantId) => {
    if (!isHostOrCoHost(currentUser.role)) return;
    setPresenterId(participantId);
  };

  const analyticsSnapshot = useMemo(() => {
    const totalSpeaking = participants.reduce((sum, participant) => sum + participant.speakingTime, 0) || 1;

    return participants.map((participant) => ({
      name: participant.name,
      speakingPercentage: Math.round((participant.speakingTime / totalSpeaking) * 100),
      engagement: participant.engagement,
      interruptions: participant.interruptions,
      networkQuality: participant.networkQuality,
    }));
  }, [participants]);

  const value = useMemo(
    () => ({
      meetingState,
      meetingId: currentMeetingId,
      currentMeetingId,
      meetingTitle,
      startTime,
      currentUser,
      participants,
      chatMessages,
      reactions,
      isChatOpen,
      isParticipantsOpen,
      isRecording,
      recordingOptions,
      agendaTemplate,
      agendaTopics,
      presenterId,
      canEditAgenda,
      canMarkAgendaCompleted,
      analyticsSnapshot,
      setMeetingId: setCurrentMeetingId,
      setMeetingTitle,
      setAgendaTemplate,
      addAgendaTopic,
      deleteAgendaTopic,
      toggleAgendaTopic,
      setPresenter,
      joinMeeting,
      leaveMeeting,
      toggleMute,
      toggleVideo,
      toggleHand,
      toggleChat,
      toggleParticipants,
      sendChatMessage,
      addReaction,
      startRecording,
      stopRecording,
      updateParticipant,
    }),
    [
      agendaTemplate,
      agendaTopics,
      presenterId,
      canEditAgenda,
      canMarkAgendaCompleted,
      analyticsSnapshot,
      chatMessages,
      currentMeetingId,
      currentUser,
      isChatOpen,
      isParticipantsOpen,
      isRecording,
      meetingState,
      meetingTitle,
      participants,
      reactions,
      recordingOptions,
      startTime,
    ],
  );

  return <MeetingContext.Provider value={value}>{children}</MeetingContext.Provider>;
}

export function useMeeting() {
  const context = useContext(MeetingContext);

  if (!context) {
    throw new Error('useMeeting must be used within a MeetingProvider');
  }

  return context;
}

export const useMeetingContext = useMeeting;
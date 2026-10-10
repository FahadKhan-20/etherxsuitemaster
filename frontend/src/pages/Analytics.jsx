import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import TopBar from '../components/layout/TopBar';
import meetingAnalytics from '../data/analytics';
import AnimatedPage from '../components/layout/AnimatedPage';
import { fadeUp, staggerContainer, staggerChild } from '../utils/animationVariants';
import apiClient, { getApiErrorMessage } from '../utils/apiClient';
import { useUser } from '../context/UserContext';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';


const GOLD = 'var(--c-d4af37)';



// Same gold-on-black palette as the dashboard.
const GOLD_SOFT = 'var(--c-e8d5a3)';
const GOLD_DEEP = 'var(--c-8a7330)';
const TOOLTIP = { background: 'color-mix(in srgb, var(--c-0a0a0c) 95%, transparent)', border: '1px solid rgba(212,175,55,0.25)', borderRadius: 14, color: 'var(--t-e8d5a3)' };
const minutes = (seconds) => Math.round(seconds / 60);

export default function Analytics() {
  const [sessions, setSessions] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    apiClient.get('/api/analytics')
      .then((res) => { if (!cancelled) setSessions(res.data?.data?.sessions || []); })
      .catch((err) => { if (!cancelled) { setSessions([]); setError(getApiErrorMessage(err, 'Could not load your meeting analytics.')); } });
    return () => { cancelled = true; };
  }, []);

  return (
    <AnimatedPage>
    <div className="min-h-[100dvh] bg-black text-app-text" style={{ position: 'relative', background: 'var(--c-000000)' }}>
      <TopBar />

      <main className="mx-auto max-w-[1450px] px-3 pb-12 pt-4 md:px-6">
        <div className="rounded-[28px] border p-6" style={{ borderColor: 'rgba(212,175,55,0.25)', background: 'color-mix(in srgb, var(--c-0a0a0c) 38%, transparent)' }}>
          <p className="text-xs font-bold uppercase tracking-[0.28em]" style={{ color: 'color-mix(in srgb, var(--t-d4af37) 90%, transparent)' }}>Meeting analytics</p>
          <h1 className="mt-2 font-syne text-4xl font-bold tracking-[-0.04em]" style={{ color: 'var(--t-e8d5a3)' }}>Read what the room was actually doing</h1>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-white/70">
            Attendance, meeting length and activity from the meetings you hosted or joined.
          </p>
          {error && <p role="alert" className="mt-3 text-sm text-red-400">{error}</p>}
        </div>

        {sessions === null ? (
          <p className="mt-6 text-sm text-white/70">Loading your meetings…</p>
        ) : sessions.length ? (
          <RealAnalytics sessions={sessions} />
        ) : (
          <SampleAnalytics />
        )}
      </main>
    </div>
    </AnimatedPage>
  );
}

/** Metrics recorded by the server from the user's finished meetings. */
function RealAnalytics({ sessions }) {
  const { user } = useUser();
  const stats = useMemo(() => {
    const lengths = sessions.map((s) => (new Date(s.endedAt) - new Date(s.startedAt)) / 1000);
    const total = lengths.reduce((a, b) => a + b, 0);
    const attendees = sessions.reduce((a, s) => a + s.participants.length, 0);
    const sum = (key) => sessions.reduce((a, s) => a + (s.counts?.[key] || 0), 0);
    // Meetings per week for the last 8 weeks, oldest first.
    const weekStart = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); x.setDate(x.getDate() - x.getDay()); return x.getTime(); };
    const thisWeek = weekStart(Date.now());
    const weeks = Array.from({ length: 8 }, (_, i) => {
      const start = thisWeek - (7 - i) * 7 * 86400000;
      return { week: new Date(start).toLocaleDateString([], { month: 'short', day: 'numeric' }), meetings: sessions.filter((s) => weekStart(s.startedAt) === start).length };
    });
    const recent = sessions.slice(0, 10).reverse().map((s) => ({
      label: new Date(s.startedAt).toLocaleDateString([], { month: 'short', day: 'numeric' }),
      people: s.participants.length,
      minutes: minutes((new Date(s.endedAt) - new Date(s.startedAt)) / 1000),
    }));
    return { total, attendees, chat: sum('chat'), hands: sum('hands'), reactions: sum('reactions'), weeks, recent, avg: total / sessions.length };
  }, [sessions]);

  return (
    <>
      <motion.div className="mt-6 grid gap-6 xl:grid-cols-2" variants={staggerContainer} initial="hidden" animate="visible">
        <motion.div variants={staggerChild}>
          <ChartCard title="Meetings per week" subtitle="Last 8 weeks">
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={stats.weeks}>
                <CartesianGrid stroke="color-mix(in srgb, var(--t-ffffff) 8%, transparent)" vertical={false} />
                <XAxis dataKey="week" tick={{ fill: 'var(--t-b5ad9a)', fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fill: 'var(--t-b5ad9a)', fontSize: 11 }} />
                <Tooltip contentStyle={TOOLTIP} />
                <Bar dataKey="meetings" fill={'var(--t-d4af37)'} radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </motion.div>
        <motion.div variants={staggerChild}>
          <ChartCard title="Attendance and length" subtitle="Your last 10 meetings">
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={stats.recent}>
                <CartesianGrid stroke="color-mix(in srgb, var(--t-ffffff) 8%, transparent)" vertical={false} />
                <XAxis dataKey="label" tick={{ fill: 'var(--t-b5ad9a)', fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fill: 'var(--t-b5ad9a)', fontSize: 11 }} />
                <Tooltip contentStyle={TOOLTIP} />
                <Bar dataKey="people" name="People" fill={'var(--t-d4af37)'} radius={[8, 8, 0, 0]} />
                <Bar dataKey="minutes" name="Minutes" fill={'var(--t-8a7330)'} radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </motion.div>
      </motion.div>

      <motion.div className="mt-6 grid gap-6 xl:grid-cols-[1fr_0.9fr]" variants={fadeUp} initial="hidden" animate="visible">
        <section className="rounded-[28px] border border-white/10 bg-white/[0.03] p-6">
          <p className="text-xs font-bold uppercase tracking-[0.28em]" style={{ color: 'color-mix(in srgb, var(--t-d4af37) 90%, transparent)' }}>Recent meetings</p>
          <div className="mt-5 space-y-3">
            {sessions.slice(0, 8).map((s) => {
              const mine = s.participants.find((p) => String(p.user) === String(user?.id));
              return (
                <div key={s._id} className="grid items-center gap-3 rounded-[20px] border border-white/10 bg-black/10 px-4 py-3 md:grid-cols-[1fr_auto_auto]">
                  <div>
                    <p className="text-sm font-medium text-white">{new Date(s.startedAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</p>
                    <p className="text-xs text-white/65">{s.roomCode}</p>
                  </div>
                  <span className="text-xs text-white/70">{s.participants.length} people · {minutes((new Date(s.endedAt) - new Date(s.startedAt)) / 1000)} min</span>
                  <span className="text-xs text-white/70">{mine ? `You: ${minutes(mine.seconds)} min` : ''}</span>
                </div>
              );
            })}
          </div>
        </section>
        <section className="rounded-[28px] border border-white/10 bg-white/[0.03] p-6">
          <p className="text-xs font-bold uppercase tracking-[0.28em]" style={{ color: 'color-mix(in srgb, var(--t-d4af37) 90%, transparent)' }}>Totals</p>
          <div className="mt-5 space-y-3">
            <MetricRow label="Meetings" value={`${sessions.length}`} />
            <MetricRow label="Time in meetings" value={`${(stats.total / 3600).toFixed(1)} h`} />
            <MetricRow label="Average length" value={`${minutes(stats.avg)} min`} />
            <MetricRow label="Average attendance" value={(stats.attendees / sessions.length).toFixed(1)} />
            <MetricRow label="Chat messages" value={`${stats.chat}`} />
            <MetricRow label="Hands raised" value={`${stats.hands}`} />
            <MetricRow label="Reactions" value={`${stats.reactions}`} />
          </div>
        </section>
      </motion.div>
    </>
  );
}

/** Illustrative charts shown until the user has a finished meeting. Clearly marked as sample data. */
function SampleAnalytics() {
  const timelineData = meetingAnalytics.sentimentData.timeline.map((point) => ({
    minute: `${point.minute}m`,
    score: Math.round(point.score * 100),
  }));

  const equityData = meetingAnalytics.speakingTime.map((entry) => ({
    name: entry.participant.split(' ')[0],
    speaking: entry.percentage,
    engagement: Math.max(40, 100 - entry.percentage),
  }));



  return (
    <>
        <div role="note" className="mt-6 rounded-[24px] border px-5 py-4 text-sm" style={{ borderColor: 'rgba(212,175,55,0.35)', background: 'rgba(212,175,55,0.08)', color: 'var(--t-e8d5a3)' }}>
          <strong>Sample data.</strong> These charts are an example, not your meetings. Your real analytics appear here after your first meeting ends.
        </div>

        <motion.div
          className="mt-6 grid gap-6 xl:grid-cols-2"
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-40px' }}
        >
          <motion.div variants={staggerChild}>
            <ChartCard title="Speaking time distribution" subtitle="Live balance across the room">
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={meetingAnalytics.speakingTime}>
                  <CartesianGrid stroke="color-mix(in srgb, var(--t-ffffff) 8%, transparent)" vertical={false} />
                  <XAxis dataKey="participant" tick={{ fill: 'var(--t-b5ad9a)', fontSize: 11 }} hide />
                  <YAxis tick={{ fill: 'var(--t-b5ad9a)', fontSize: 11 }} />
                  <Tooltip contentStyle={TOOLTIP} />
                  <Bar dataKey="percentage" fill={'var(--t-d4af37)'} radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          </motion.div>

          <motion.div variants={staggerChild}>
            <ChartCard title="Room energy over time" subtitle="Sentiment meter across the timeline">
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={timelineData}>
                  <CartesianGrid stroke="color-mix(in srgb, var(--t-ffffff) 8%, transparent)" vertical={false} />
                  <XAxis dataKey="minute" tick={{ fill: 'var(--t-b5ad9a)', fontSize: 11 }} />
                  <YAxis tick={{ fill: 'var(--t-b5ad9a)', fontSize: 11 }} />
                  <Tooltip contentStyle={TOOLTIP} />
                  <Line type="monotone" dataKey="score" stroke={'var(--t-d4af37)'} strokeWidth={3} dot={{ r: 4, fill: 'var(--t-d4af37)' }} />
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>
          </motion.div>

          <motion.div variants={staggerChild}>
            <ChartCard title="Participation equity score" subtitle="Who dominated and who needs a nudge">
              <ResponsiveContainer width="100%" height={280}>
                <RadarChart data={equityData}>
                  <PolarGrid stroke="color-mix(in srgb, var(--t-ffffff) 8%, transparent)" />
                  <PolarAngleAxis dataKey="name" tick={{ fill: 'var(--t-b5ad9a)', fontSize: 11 }} />
                  <Radar name="Speaking" dataKey="speaking" stroke={'var(--t-d4af37)'} fill={'var(--t-d4af37)'} fillOpacity={0.3} />
                  <Radar name="Engagement" dataKey="engagement" stroke={'var(--t-e8d5a3)'} fill={'var(--t-e8d5a3)'} fillOpacity={0.22} />
                </RadarChart>
              </ResponsiveContainer>
            </ChartCard>
          </motion.div>

          <motion.div variants={staggerChild}>
            <ChartCard title="Word cloud terms" subtitle="Themes repeated most in the meeting">
              <div className="flex flex-wrap gap-3">
                {meetingAnalytics.wordCloud.map((term) => (
                  <span
                    key={term.word}
                    className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-white/70"
                    style={{ fontSize: `${12 + term.count / 4}px` }}
                  >
                    {term.word}
                  </span>
                ))}
              </div>
            </ChartCard>
          </motion.div>
        </motion.div>

        <motion.div
          className="mt-6 grid gap-6 xl:grid-cols-[1fr_0.9fr]"
          variants={fadeUp}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-40px' }}
        >
          <section className="rounded-[28px] border border-white/10 bg-white/[0.03] p-6">
            <p className="text-xs font-bold uppercase tracking-[0.28em]" style={{ color: 'color-mix(in srgb, var(--t-d4af37) 90%, transparent)' }}>Swimlane timeline</p>
            <div className="mt-5 space-y-4">
              {meetingAnalytics.speakingTime.map((entry, index) => (
                <div key={entry.participant} className="grid items-center gap-3 md:grid-cols-[180px_1fr_auto]">
                  <p className="text-sm font-medium text-white">{entry.participant}</p>
                  <div className="h-3 overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-[linear-gradient(90deg,var(--c-b8860b),var(--c-d4af37))]"
                      style={{ width: `${entry.percentage * 2.2}%` }}
                    />
                  </div>
                  <span className="text-xs text-white/70">{entry.duration} min</span>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-[28px] border border-white/10 bg-white/[0.03] p-6">
            <p className="text-xs font-bold uppercase tracking-[0.28em]" style={{ color: 'color-mix(in srgb, var(--t-d4af37) 90%, transparent)' }}>Quality indicators</p>
            <div className="mt-5 space-y-3">
              <MetricRow label="Engagement score" value={`${meetingAnalytics.engagementScore}/100`} />
              <MetricRow label="Interruptions" value={`${meetingAnalytics.interruptionCount}`} />
              <MetricRow label="Questions raised" value={`${meetingAnalytics.participationMetrics.questionsAsked}`} />
              <MetricRow label="Action items created" value={`${meetingAnalytics.participationMetrics.actionItemsCreated}`} />
              <MetricRow label="Participation equity" value={meetingAnalytics.healthIndicators.inclusive ? 'Balanced' : 'Needs attention'} />
            </div>
          </section>
        </motion.div>
    </>
  );
}

function ChartCard({ title, subtitle, children }) {
  return (
    <section className="rounded-[28px] border border-white/10 bg-white/[0.03] p-6">
      <p className="text-xs font-bold uppercase tracking-[0.28em]" style={{ color: 'color-mix(in srgb, var(--t-d4af37) 90%, transparent)' }}>{subtitle}</p>
      <h2 className="mt-2 text-2xl font-semibold" style={{ color: 'var(--t-e8d5a3)' }}>{title}</h2>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function MetricRow({ label, value }) {
  return (
    <div className="flex items-center justify-between rounded-[24px] border border-white/10 bg-black/10 px-4 py-4">
      <span className="text-sm text-white/70">{label}</span>
      <span className="font-semibold text-white">{value}</span>
    </div>
  );
}

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const COLORS = ['var(--c-4f46e5)', 'var(--c-06b6d4)', 'var(--c-10b981)', 'var(--c-f59e0b)', 'var(--c-ef4444)', 'var(--c-8b5cf6)'];

export default function SpeakingTimeChart({ data }) {
  if (!data || data.length === 0) {
    return <div className="text-center text-gray-400 py-4">No data yet</div>;
  }
  
  return (
    <div className="h-48">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="color-mix(in srgb, var(--t-ffffff) 10%, transparent)" />
          <XAxis 
            dataKey="name" 
            tick={{ fill: 'var(--t-9ca3af)', fontSize: 12 }}
            stroke="color-mix(in srgb, var(--t-ffffff) 20%, transparent)"
          />
          <YAxis 
            tick={{ fill: 'var(--t-9ca3af)', fontSize: 12 }}
            stroke="color-mix(in srgb, var(--t-ffffff) 20%, transparent)"
          />
          <Tooltip 
            contentStyle={{ 
              background: 'color-mix(in srgb, var(--c-13132b) 90%, transparent)', 
              border: '1px solid rgba(79, 70, 229, 0.3)',
              borderRadius: '8px'
            }}
            labelStyle={{ color: 'var(--t-e8d5a3)' }}
          />
          <Bar dataKey="percentage" radius={[8, 8, 0, 0]}>
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

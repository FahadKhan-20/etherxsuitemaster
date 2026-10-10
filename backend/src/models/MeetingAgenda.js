const { randomUUID } = require('crypto');
const { query } = require('../config/db');

// topics: [{ _id, title, completed }], stored as jsonb in list order.
const toAgenda = row => row && {
  _id: row.id,
  roomCode: row.room_code,
  topics: row.topics,
  createdBy: row.created_by,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
};
const one = async (sql, params) => toAgenda((await query(sql, params)).rows[0]) || null;
const topic = ({ title, completed = false }) => ({ _id: randomUUID(), title, completed });

const findByRoom = roomCode => one('select * from meeting_agendas where room_code = $1', [String(roomCode).trim()]);

/** Creates the room's agenda or replaces its topics. */
const upsert = ({ roomCode, topics, createdBy }) => one(
  `insert into meeting_agendas (room_code, topics, created_by) values ($1, $2, $3)
   on conflict (room_code) do update set topics = excluded.topics, created_by = excluded.created_by, updated_at = now()
   returning *`,
  [String(roomCode).trim(), JSON.stringify(topics.map(topic)), createdBy]
);

const addTopic = (roomCode, title) => one(
  'update meeting_agendas set topics = topics || jsonb_build_array($2::jsonb), updated_at = now() where room_code = $1 returning *',
  [roomCode, JSON.stringify(topic({ title }))]
);

/** Null when the agenda or the topic does not exist. */
const setTopicCompleted = (roomCode, topicId, completed) => one(
  `update meeting_agendas set updated_at = now(), topics = (
     select jsonb_agg(case when t->>'_id' = $2 then jsonb_set(t, '{completed}', to_jsonb($3::boolean)) else t end order by i)
     from jsonb_array_elements(topics) with ordinality as x(t, i))
   where room_code = $1 and topics @> jsonb_build_array(jsonb_build_object('_id', $2::text))
   returning *`,
  [roomCode, String(topicId), completed]
);

const removeTopic = (roomCode, topicId) => one(
  `update meeting_agendas set updated_at = now(), topics = coalesce((
     select jsonb_agg(t order by i) from jsonb_array_elements(topics) with ordinality as x(t, i) where t->>'_id' <> $2), '[]')
   where room_code = $1 returning *`,
  [roomCode, String(topicId)]
);

module.exports = { findByRoom, upsert, addTopic, setTopicCompleted, removeTopic };

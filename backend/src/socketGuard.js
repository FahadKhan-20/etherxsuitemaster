// Clients control both the payload and the acknowledgement argument of every socket event. One bad message
// must never throw out of a handler: in Node that exits the process and ends every meeting on the server.

/** The client's acknowledgement callback, or a no-op when it sent something else. */
const safeAck = ack => (typeof ack === 'function' ? ack : () => {});

/** socket.on that contains sync throws and async rejections to the event that caused them. */
function guardedOn(socket, event, handler) {
  socket.on(event, (...args) => {
    const fail = error => console.error(`[socket] ${event} failed:`, error?.message || error);
    try {
      const result = handler(...args);
      if (result && typeof result.catch === 'function') result.catch(fail);
    } catch (error) {
      fail(error);
    }
  });
}

module.exports = { safeAck, guardedOn };

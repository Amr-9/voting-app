package ws

import "log/slog"

// Hub maintains the set of active WebSocket clients and broadcasts messages to them.
// All channels are goroutine-safe — client registration and broadcasting happen via channels.
type Hub struct {
	// All currently connected clients
	clients map[*Client]bool

	// Inbound messages to broadcast to all clients
	Broadcast chan []byte

	// Register a new client
	register chan *Client

	// Unregister and remove a disconnected client
	unregister chan *Client
}

// NewHub creates and returns a new Hub instance.
func NewHub() *Hub {
	return &Hub{
		clients:    make(map[*Client]bool),
		Broadcast:  make(chan []byte, 256),
		register:   make(chan *Client),
		unregister: make(chan *Client),
	}
}

// Run starts the Hub event loop. Must be called as a goroutine.
func (h *Hub) Run() {
	for {
		select {
		case client := <-h.register:
			h.clients[client] = true
			slog.Info("WebSocket client connected", "total", len(h.clients))

		case client := <-h.unregister:
			if _, ok := h.clients[client]; ok {
				delete(h.clients, client)
				close(client.send)
				slog.Info("WebSocket client disconnected", "total", len(h.clients))
			}

		case message := <-h.Broadcast:
			// Send the message to every connected client
			for client := range h.clients {
				select {
				case client.send <- message:
				default:
					// Client's send buffer is full — drop and disconnect
					close(client.send)
					delete(h.clients, client)
				}
			}
		}
	}
}

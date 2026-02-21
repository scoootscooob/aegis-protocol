// Package main — Aegis Swarm Consensus Engine.
//
// Centralized cloud service that ingests anonymous Indicators of
// Compromise (IOCs) from all Aegis SDK instances globally.  Uses TWAB
// (Time-Weighted Average Balance) to prevent Sybil poisoning.  Compiles
// verified malicious addresses into a compressed Bloom Filter and pushes
// it via WebSockets to Enterprise clients.
//
// Phase 5.1 of the v2.0 roadmap.
package main

import (
	"encoding/json"
	"log"
	"net/http"
	"sync"
	"time"
)

// IOCReport is an anonymous Indicator of Compromise report from an Aegis SDK.
type IOCReport struct {
	Address    string    `json:"address"`
	Selector   string    `json:"selector,omitempty"`
	ChainID    int       `json:"chain_id"`
	Confidence float64   `json:"confidence"`
	Timestamp  time.Time `json:"timestamp"`
	SourceID   string    `json:"source_id"` // anonymous hash of the reporting agent
}

// SwarmAggregator ingests IOC reports and compiles a consensus Bloom filter.
type SwarmAggregator struct {
	mu          sync.RWMutex
	bloomFilter *BloomFilter
	twab        *TWAB
	subscribers map[string]chan []byte // subscriber_id -> channel
	subMu       sync.RWMutex
}

// NewSwarmAggregator creates a new aggregator with default TWAB config.
func NewSwarmAggregator() *SwarmAggregator {
	return &SwarmAggregator{
		bloomFilter: NewBloomFilter(),
		twab:        NewTWAB(DefaultTWABConfig()),
		subscribers: make(map[string]chan []byte),
	}
}

// NewSwarmAggregatorWithConfig creates an aggregator with custom TWAB config.
func NewSwarmAggregatorWithConfig(config TWABConfig) *SwarmAggregator {
	return &SwarmAggregator{
		bloomFilter: NewBloomFilter(),
		twab:        NewTWAB(config),
		subscribers: make(map[string]chan []byte),
	}
}

// IngestReport processes a new IOC report.
//
// The report is added to the TWAB tracker.  If the address meets the
// consensus threshold (enough independent reports over time), it is
// added to the Bloom filter and pushed to all subscribers.
func (s *SwarmAggregator) IngestReport(report IOCReport) bool {
	s.mu.Lock()
	s.twab.Record(report.Address, report)

	if s.twab.MeetsThreshold(report.Address) {
		s.bloomFilter.Add(report.Address)
		s.mu.Unlock()
		s.pushToSubscribers()
		return true // address was added to filter
	}

	s.mu.Unlock()
	return false
}

// BloomFilterLen returns the number of addresses in the Bloom filter.
func (s *SwarmAggregator) BloomFilterLen() int {
	return s.bloomFilter.Len()
}

// Subscribe registers a new WebSocket subscriber.
func (s *SwarmAggregator) Subscribe(id string) chan []byte {
	s.subMu.Lock()
	defer s.subMu.Unlock()

	ch := make(chan []byte, 16)
	s.subscribers[id] = ch
	return ch
}

// Unsubscribe removes a subscriber.
func (s *SwarmAggregator) Unsubscribe(id string) {
	s.subMu.Lock()
	defer s.subMu.Unlock()

	if ch, ok := s.subscribers[id]; ok {
		close(ch)
		delete(s.subscribers, id)
	}
}

// pushToSubscribers serializes the Bloom filter and sends it to all subscribers.
func (s *SwarmAggregator) pushToSubscribers() {
	data, err := s.bloomFilter.Serialize()
	if err != nil {
		log.Printf("Failed to serialize bloom filter: %v", err)
		return
	}

	s.subMu.RLock()
	defer s.subMu.RUnlock()

	for id, ch := range s.subscribers {
		select {
		case ch <- data:
		default:
			log.Printf("Subscriber %s too slow, skipping push", id)
		}
	}
}

// handleIngest is the HTTP handler for POST /ingest.
func (s *SwarmAggregator) handleIngest(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var report IOCReport
	if err := json.NewDecoder(r.Body).Decode(&report); err != nil {
		http.Error(w, "Invalid JSON", http.StatusBadRequest)
		return
	}

	if report.Timestamp.IsZero() {
		report.Timestamp = time.Now()
	}

	added := s.IngestReport(report)
	resp := map[string]interface{}{
		"accepted": true,
		"added_to_filter": added,
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}

// handleHealth is the HTTP handler for GET /health.
func (s *SwarmAggregator) handleHealth(w http.ResponseWriter, r *http.Request) {
	resp := map[string]interface{}{
		"status":       "ok",
		"filter_size":  s.bloomFilter.Len(),
		"filter_version": s.bloomFilter.Version(),
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}

func main() {
	agg := NewSwarmAggregator()

	http.HandleFunc("/ingest", agg.handleIngest)
	http.HandleFunc("/health", agg.handleHealth)

	log.Println("Aegis Swarm Aggregator listening on :9090")
	if err := http.ListenAndServe(":9090", nil); err != nil {
		log.Fatal(err)
	}
}

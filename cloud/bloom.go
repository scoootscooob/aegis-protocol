// Package main — Aegis Swarm Bloom Filter utilities.
//
// A compressed Bloom filter with O(1) lookups is the primary transport
// format for pushing consensus blacklists to enterprise clients.
package main

import (
	"encoding/json"
	"sync"
)

// BloomFilter is a concurrent-safe Bloom filter wrapper.
type BloomFilter struct {
	mu      sync.RWMutex
	entries map[string]bool // Simplified for initial implementation
	version uint64
}

// NewBloomFilter creates a new empty Bloom filter.
func NewBloomFilter() *BloomFilter {
	return &BloomFilter{
		entries: make(map[string]bool),
		version: 0,
	}
}

// Add inserts an address into the filter.
func (bf *BloomFilter) Add(address string) {
	bf.mu.Lock()
	defer bf.mu.Unlock()
	bf.entries[address] = true
	bf.version++
}

// Contains checks if an address might be in the filter.
func (bf *BloomFilter) Contains(address string) bool {
	bf.mu.RLock()
	defer bf.mu.RUnlock()
	return bf.entries[address]
}

// Len returns the number of entries.
func (bf *BloomFilter) Len() int {
	bf.mu.RLock()
	defer bf.mu.RUnlock()
	return len(bf.entries)
}

// Version returns the current filter version.
func (bf *BloomFilter) Version() uint64 {
	bf.mu.RLock()
	defer bf.mu.RUnlock()
	return bf.version
}

// Serialize returns a JSON representation for WebSocket push.
func (bf *BloomFilter) Serialize() ([]byte, error) {
	bf.mu.RLock()
	defer bf.mu.RUnlock()

	payload := struct {
		Version  uint64   `json:"version"`
		Entries  []string `json:"entries"`
		Count    int      `json:"count"`
	}{
		Version: bf.version,
		Count:   len(bf.entries),
	}

	for addr := range bf.entries {
		payload.Entries = append(payload.Entries, addr)
	}

	return json.Marshal(payload)
}

// Package main — Time-Weighted Average Balance (TWAB) for Sybil resistance.
//
// An address must receive IOC reports from multiple independent sources
// over time before being included in the consensus Bloom filter.  This
// prevents a single malicious actor from poisoning the threat feed.
package main

import (
	"sync"
	"time"
)

// TWABConfig holds thresholds for the TWAB gate.
type TWABConfig struct {
	// MinReportCount is the minimum number of independent reports
	// required before an address enters the Bloom filter.
	MinReportCount int

	// MinTimeSpanSeconds is the minimum time span (in seconds) between
	// the first and last report.  This prevents burst-reporting.
	MinTimeSpanSeconds float64

	// MinDistinctSources is the minimum number of distinct agent sources
	// that must report the same address.
	MinDistinctSources int
}

// DefaultTWABConfig returns sensible defaults for production.
func DefaultTWABConfig() TWABConfig {
	return TWABConfig{
		MinReportCount:     3,
		MinTimeSpanSeconds: 3600.0, // 1 hour
		MinDistinctSources: 2,
	}
}

// TWABEntry tracks reports for a single address.
type TWABEntry struct {
	Reports   []IOCReport
	Sources   map[string]bool // distinct source IDs
	FirstSeen time.Time
	LastSeen  time.Time
}

// TWAB implements Time-Weighted Average Balance Sybil resistance.
type TWAB struct {
	mu      sync.RWMutex
	config  TWABConfig
	entries map[string]*TWABEntry // address -> entry
}

// NewTWAB creates a TWAB with the given configuration.
func NewTWAB(config TWABConfig) *TWAB {
	return &TWAB{
		config:  config,
		entries: make(map[string]*TWABEntry),
	}
}

// Record adds a report for an address.
func (t *TWAB) Record(address string, report IOCReport) {
	t.mu.Lock()
	defer t.mu.Unlock()

	entry, ok := t.entries[address]
	if !ok {
		entry = &TWABEntry{
			Sources:   make(map[string]bool),
			FirstSeen: report.Timestamp,
		}
		t.entries[address] = entry
	}

	entry.Reports = append(entry.Reports, report)
	entry.Sources[report.SourceID] = true
	entry.LastSeen = report.Timestamp
}

// MeetsThreshold checks whether an address has sufficient independent
// reports over enough time to be included in the Bloom filter.
func (t *TWAB) MeetsThreshold(address string) bool {
	t.mu.RLock()
	defer t.mu.RUnlock()

	entry, ok := t.entries[address]
	if !ok {
		return false
	}

	if len(entry.Reports) < t.config.MinReportCount {
		return false
	}

	timeSpan := entry.LastSeen.Sub(entry.FirstSeen).Seconds()
	if timeSpan < t.config.MinTimeSpanSeconds {
		return false
	}

	if len(entry.Sources) < t.config.MinDistinctSources {
		return false
	}

	return true
}

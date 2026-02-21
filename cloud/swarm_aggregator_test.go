package main

import (
	"testing"
	"time"
)

func TestIngestReportBelowThreshold(t *testing.T) {
	agg := NewSwarmAggregator()

	report := IOCReport{
		Address:   "0xAttacker1",
		ChainID:   1,
		Confidence: 0.9,
		Timestamp: time.Now(),
		SourceID:  "agent-A",
	}

	added := agg.IngestReport(report)
	if added {
		t.Error("Expected report NOT to be added to filter (below threshold)")
	}
	if agg.BloomFilterLen() != 0 {
		t.Error("Bloom filter should be empty")
	}
}

func TestTWABThresholdMet(t *testing.T) {
	config := TWABConfig{
		MinReportCount:     2,
		MinTimeSpanSeconds: 0.0, // disable time span for test speed
		MinDistinctSources: 2,
	}
	agg := NewSwarmAggregatorWithConfig(config)

	// Report from source A
	r1 := IOCReport{
		Address:   "0xEvil",
		ChainID:   1,
		Confidence: 0.95,
		Timestamp: time.Now(),
		SourceID:  "agent-A",
	}
	agg.IngestReport(r1)

	// Report from source B (different source)
	r2 := IOCReport{
		Address:   "0xEvil",
		ChainID:   1,
		Confidence: 0.90,
		Timestamp: time.Now().Add(time.Second),
		SourceID:  "agent-B",
	}
	added := agg.IngestReport(r2)

	if !added {
		t.Error("Expected address to be added to filter after meeting threshold")
	}
	if agg.BloomFilterLen() != 1 {
		t.Errorf("Expected 1 entry in bloom filter, got %d", agg.BloomFilterLen())
	}
}

func TestSybilResistanceSingleSource(t *testing.T) {
	config := TWABConfig{
		MinReportCount:     3,
		MinTimeSpanSeconds: 0.0,
		MinDistinctSources: 2, // requires 2 distinct sources
	}
	agg := NewSwarmAggregatorWithConfig(config)

	// All reports from the same source — should NOT meet threshold
	for i := 0; i < 10; i++ {
		r := IOCReport{
			Address:   "0xVictim",
			ChainID:   1,
			Confidence: 1.0,
			Timestamp: time.Now().Add(time.Duration(i) * time.Second),
			SourceID:  "sybil-attacker",
		}
		agg.IngestReport(r)
	}

	if agg.BloomFilterLen() != 0 {
		t.Error("Single-source Sybil attack should NOT add to bloom filter")
	}
}

func TestBloomFilterAddAndContains(t *testing.T) {
	bf := NewBloomFilter()
	bf.Add("0xAAAA")
	bf.Add("0xBBBB")

	if !bf.Contains("0xAAAA") {
		t.Error("Expected 0xAAAA to be in filter")
	}
	if !bf.Contains("0xBBBB") {
		t.Error("Expected 0xBBBB to be in filter")
	}
	if bf.Contains("0xCCCC") {
		t.Error("Expected 0xCCCC to NOT be in filter")
	}
	if bf.Len() != 2 {
		t.Errorf("Expected 2 entries, got %d", bf.Len())
	}
}

func TestBloomFilterSerialize(t *testing.T) {
	bf := NewBloomFilter()
	bf.Add("0xAAAA")

	data, err := bf.Serialize()
	if err != nil {
		t.Fatalf("Serialize failed: %v", err)
	}
	if len(data) == 0 {
		t.Error("Serialized data should not be empty")
	}
}

func TestSubscriberReceivesPush(t *testing.T) {
	config := TWABConfig{
		MinReportCount:     1,
		MinTimeSpanSeconds: 0.0,
		MinDistinctSources: 1,
	}
	agg := NewSwarmAggregatorWithConfig(config)

	ch := agg.Subscribe("test-sub")
	defer agg.Unsubscribe("test-sub")

	r := IOCReport{
		Address:   "0xPushed",
		ChainID:   1,
		Confidence: 1.0,
		Timestamp: time.Now(),
		SourceID:  "agent-X",
	}
	agg.IngestReport(r)

	select {
	case data := <-ch:
		if len(data) == 0 {
			t.Error("Expected non-empty push data")
		}
	case <-time.After(time.Second):
		t.Error("Subscriber did not receive push within 1 second")
	}
}

func TestConcurrentAccess(t *testing.T) {
	agg := NewSwarmAggregator()
	done := make(chan bool, 10)

	// Spawn 10 goroutines ingesting concurrently
	for i := 0; i < 10; i++ {
		go func(idx int) {
			r := IOCReport{
				Address:   "0xConcurrent",
				ChainID:   1,
				Confidence: 0.8,
				Timestamp: time.Now(),
				SourceID:  "agent-" + string(rune('A'+idx)),
			}
			agg.IngestReport(r)
			done <- true
		}(i)
	}

	for i := 0; i < 10; i++ {
		<-done
	}
	// Just verify no panic — concurrent access is safe
}

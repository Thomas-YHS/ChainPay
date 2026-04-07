package services

import (
	"context"
	"fmt"
	"sync"

	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/ethclient"
)

// DialEthClient is the package-level helper exported for main.go.
// H-2 fixed: propagates the dial error instead of discarding it.
func DialEthClient(rpcURL string) (*ethclient.Client, error) {
	return ethclient.Dial(rpcURL)
}

// NonceManager provides a thread-safe, locally-incrementing nonce for a single
// executor address. Both EmployeeService and PayrollService share one instance
// so concurrent transactions don't collide on nonce.
type NonceManager struct {
	mu      sync.Mutex
	client  *ethclient.Client
	address common.Address
	next    *uint64
}

// NewNonceManager creates a manager for the given address.
func NewNonceManager(client *ethclient.Client, address common.Address) *NonceManager {
	return &NonceManager{client: client, address: address}
}

// Addr returns the managed address.
func (m *NonceManager) Addr() common.Address {
	return m.address
}

// Next returns the next nonce to use and increments the local counter.
// On the first call (or after Reset) it fetches the pending nonce from the chain.
func (m *NonceManager) Next(ctx context.Context) (uint64, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	if m.next == nil {
		n, err := m.client.PendingNonceAt(ctx, m.address)
		if err != nil {
			return 0, fmt.Errorf("pending nonce: %w", err)
		}
		m.next = &n
	}
	val := *m.next
	*m.next++
	return val, nil
}

// Reset forces re-sync with the chain on the next Next() call.
// Call this whenever a transaction is rejected (e.g. nonce too low/high).
func (m *NonceManager) Reset() {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.next = nil
}

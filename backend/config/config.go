package config

import (
	"fmt"
	"os"

	"github.com/goccy/go-yaml"
)

type Config struct {
	Server     ServerConfig     `yaml:"server"`
	Database   DatabaseConfig  `yaml:"database"`
	Blockchain BlockchainConfig `yaml:"blockchain"`
}

type ServerConfig struct {
	Port string `yaml:"port"`
}

type DatabaseConfig struct {
	Host     string `yaml:"host"`
	Port     string `yaml:"port"`
	User     string `yaml:"user"`
	Password string `yaml:"password"`
	Name     string `yaml:"name"`
	SSLMode  string `yaml:"sslmode"`
}

type BlockchainConfig struct {
	ChainPayContract   string `yaml:"chain_pay_contract"`
	ExecutorPrivateKey string `yaml:"executor_private_key"`
	LiFiAPIKey         string `yaml:"lifi_api_key"`
	EthRPCURL          string `yaml:"eth_rpc_url"`
}

// Load reads config from config.yaml.
// CONFIG_PATH env var overrides the default path (backend/config.yaml).
func Load() (*Config, error) {
	path := os.Getenv("CONFIG_PATH")
	if path == "" {
		// Default: look for config.yaml relative to working directory
		path = "config.yaml"
	}

	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("failed to read config.yaml at %s: %w", path, err)
	}

	var cfg Config
	if err := yaml.Unmarshal(data, &cfg); err != nil {
		return nil, fmt.Errorf("failed to parse config.yaml: %w", err)
	}

	// Validation
	if cfg.Database.Password == "" {
		return nil, fmt.Errorf("database.password is required in config.yaml")
	}

	// Apply defaults
	if cfg.Server.Port == "" {
		cfg.Server.Port = "8080"
	}
	if cfg.Database.Port == "" {
		cfg.Database.Port = "5432"
	}
	if cfg.Database.SSLMode == "" {
		cfg.Database.SSLMode = "disable"
	}
	if cfg.Blockchain.EthRPCURL == "" {
		cfg.Blockchain.EthRPCURL = "https://mainnet.base.org"
	}

	return &cfg, nil
}

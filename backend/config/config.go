package config

import (
	"os"
)

type Config struct {
	Port             string
	DBHost           string
	DBPort           string
	DBUser           string
	DBPassword       string
	DBName           string
	DBSSLMode        string
	ExecutorPrivateKey string
	ChainPayContract string
	LiFiAPIKey       string
}

func Load() *Config {
	return &Config{
		Port:             getEnv("PORT", "8080"),
		DBHost:           getEnv("DB_HOST", "localhost"),
		DBPort:           getEnv("DB_PORT", "5432"),
		DBUser:           getEnv("DB_USER", "chainpay"),
		DBPassword:       getEnv("DB_PASSWORD", "password"),
		DBName:           getEnv("DB_NAME", "chainpay_db"),
		DBSSLMode:        getEnv("DB_SSLMODE", "disable"),
		ExecutorPrivateKey: os.Getenv("EXECUTOR_PRIVATE_KEY"),
		ChainPayContract: os.Getenv("CHAIN_PAY_CONTRACT"),
		LiFiAPIKey:       os.Getenv("LIFI_API_KEY"),
	}
}

func getEnv(key, defaultVal string) string {
	if val := os.Getenv(key); val != "" {
		return val
	}
	return defaultVal
}

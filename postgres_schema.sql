-- AegisOne PostgreSQL Production Schema
-- Generated for high-performance and end-to-end production setup.

CREATE TABLE audit_logs (
	id SERIAL NOT NULL, 
	organization_id VARCHAR(64), 
	actor_email VARCHAR(255), 
	action VARCHAR(100) NOT NULL, 
	module VARCHAR(64), 
	target VARCHAR(512), 
	result VARCHAR(50), 
	ip_address VARCHAR(45), 
	device_id VARCHAR(128), 
	timestamp TIMESTAMP WITHOUT TIME ZONE DEFAULT now(), 
	PRIMARY KEY (id)
);

CREATE INDEX ix_audit_logs_organization_id ON audit_logs (organization_id);

CREATE INDEX ix_al_org_ts ON audit_logs (organization_id, timestamp);

CREATE INDEX ix_audit_logs_timestamp ON audit_logs (timestamp);

CREATE TABLE credential_events (
	id SERIAL NOT NULL, 
	credential_event_id VARCHAR(128) NOT NULL, 
	organization_id VARCHAR(64) NOT NULL, 
	website_scan_id VARCHAR(128), 
	domain VARCHAR(255), 
	form_action TEXT, 
	credential_type VARCHAR(64), 
	blocked BOOLEAN, 
	user_action VARCHAR(32), 
	created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now(), 
	PRIMARY KEY (id)
);

CREATE UNIQUE INDEX ix_credential_events_credential_event_id ON credential_events (credential_event_id);

CREATE INDEX ix_ce_org_created ON credential_events (organization_id, created_at);

CREATE INDEX ix_credential_events_organization_id ON credential_events (organization_id);

CREATE INDEX ix_credential_events_created_at ON credential_events (created_at);

CREATE TABLE dashboard_statistics (
	id SERIAL NOT NULL, 
	organization_id VARCHAR(64) NOT NULL, 
	date DATE NOT NULL, 
	total_scans INTEGER, 
	threats_blocked INTEGER, 
	threats_warned INTEGER, 
	safe_scans INTEGER, 
	credential_attempts INTEGER, 
	downloads_blocked INTEGER, 
	downloads_scanned INTEGER, 
	xai_sessions INTEGER, 
	manual_scans INTEGER, 
	threat_reports INTEGER, 
	top_threat_type VARCHAR(100), 
	computed_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now(), 
	PRIMARY KEY (id)
);

CREATE INDEX ix_dashboard_statistics_date ON dashboard_statistics (date);

CREATE INDEX ix_dashboard_statistics_organization_id ON dashboard_statistics (organization_id);

CREATE UNIQUE INDEX ix_ds_org_date ON dashboard_statistics (organization_id, date);

CREATE TABLE devices (
	id SERIAL NOT NULL, 
	device_id VARCHAR(128) NOT NULL, 
	organization_id VARCHAR(64) NOT NULL, 
	user_id INTEGER, 
	browser VARCHAR(100), 
	browser_version VARCHAR(50), 
	os VARCHAR(100), 
	extension_version VARCHAR(20), 
	status VARCHAR(32), 
	last_seen TIMESTAMP WITHOUT TIME ZONE DEFAULT now(), 
	created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now(), 
	PRIMARY KEY (id)
);

CREATE UNIQUE INDEX ix_devices_device_id ON devices (device_id);

CREATE INDEX ix_devices_user_id ON devices (user_id);

CREATE INDEX ix_devices_organization_id ON devices (organization_id);

CREATE INDEX ix_devices_org_status ON devices (organization_id, status);

CREATE TABLE download_events (
	id SERIAL NOT NULL, 
	download_id VARCHAR(128) NOT NULL, 
	organization_id VARCHAR(64) NOT NULL, 
	user_id VARCHAR(128), 
	device_id VARCHAR(128), 
	filename VARCHAR(512) NOT NULL, 
	extension VARCHAR(32), 
	sha256 VARCHAR(64), 
	file_size_kb FLOAT, 
	risk_score INTEGER, 
	threat_type VARCHAR(100), 
	decision VARCHAR(20), 
	macros_found BOOLEAN, 
	created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now(), 
	PRIMARY KEY (id)
);

CREATE INDEX ix_download_events_created_at ON download_events (created_at);

CREATE INDEX ix_de_org_created ON download_events (organization_id, created_at);

CREATE INDEX ix_download_events_sha256 ON download_events (sha256);

CREATE UNIQUE INDEX ix_download_events_download_id ON download_events (download_id);

CREATE INDEX ix_download_events_organization_id ON download_events (organization_id);

CREATE TABLE hover_scans (
	id SERIAL NOT NULL, 
	hover_scan_id VARCHAR(128) NOT NULL, 
	organization_id VARCHAR(64), 
	website_scan_id VARCHAR(128), 
	destination TEXT NOT NULL, 
	domain VARCHAR(255), 
	risk_score INTEGER, 
	cached BOOLEAN, 
	created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now(), 
	PRIMARY KEY (id)
);

CREATE UNIQUE INDEX ix_hover_scans_hover_scan_id ON hover_scans (hover_scan_id);

CREATE TABLE manual_scans (
	id SERIAL NOT NULL, 
	scan_id VARCHAR(128) NOT NULL, 
	organization_id VARCHAR(64) NOT NULL, 
	user_id VARCHAR(128), 
	device_id VARCHAR(128), 
	scan_type VARCHAR(50) NOT NULL, 
	target_summary VARCHAR(512), 
	risk_score INTEGER, 
	verdict VARCHAR(20), 
	threat_type VARCHAR(100), 
	created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now(), 
	PRIMARY KEY (id)
);

CREATE INDEX ix_manual_scans_created_at ON manual_scans (created_at);

CREATE UNIQUE INDEX ix_manual_scans_scan_id ON manual_scans (scan_id);

CREATE INDEX ix_manual_scans_organization_id ON manual_scans (organization_id);

CREATE TABLE organizations (
	id VARCHAR(64) NOT NULL, 
	name VARCHAR(255) NOT NULL, 
	domain VARCHAR(255), 
	plan VARCHAR(50), 
	is_active BOOLEAN, 
	created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now(), 
	PRIMARY KEY (id)
);

CREATE TABLE policies (
	id SERIAL NOT NULL, 
	organization_id VARCHAR(64) NOT NULL, 
	policy_type VARCHAR(50) NOT NULL, 
	value VARCHAR(512) NOT NULL, 
	action VARCHAR(20), 
	scope VARCHAR(50), 
	scope_value VARCHAR(255), 
	priority INTEGER, 
	enabled BOOLEAN, 
	created_by VARCHAR(255), 
	created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now(), 
	PRIMARY KEY (id)
);

CREATE INDEX ix_pol_org_enabled ON policies (organization_id, enabled);

CREATE INDEX ix_policies_organization_id ON policies (organization_id);

CREATE TABLE security_events (
	id SERIAL NOT NULL, 
	event_id VARCHAR(128) NOT NULL, 
	organization_id VARCHAR(64) NOT NULL, 
	user_id VARCHAR(128), 
	device_id VARCHAR(128), 
	website_scan_id VARCHAR(128), 
	event_type VARCHAR(64) NOT NULL, 
	severity VARCHAR(20), 
	module VARCHAR(64), 
	decision VARCHAR(20), 
	risk_score INTEGER, 
	url TEXT, 
	domain VARCHAR(255), 
	threat_type VARCHAR(100), 
	details TEXT, 
	timestamp TIMESTAMP WITHOUT TIME ZONE DEFAULT now(), 
	PRIMARY KEY (id)
);

CREATE INDEX ix_security_events_timestamp ON security_events (timestamp);

CREATE INDEX ix_security_events_organization_id ON security_events (organization_id);

CREATE INDEX ix_se_org_severity ON security_events (organization_id, severity);

CREATE INDEX ix_security_events_severity ON security_events (severity);

CREATE INDEX ix_se_org_type ON security_events (organization_id, event_type);

CREATE INDEX ix_security_events_event_type ON security_events (event_type);

CREATE UNIQUE INDEX ix_security_events_event_id ON security_events (event_id);

CREATE INDEX ix_se_org_ts ON security_events (organization_id, timestamp);

CREATE TABLE threat_reports (
	id SERIAL NOT NULL, 
	report_id VARCHAR(128) NOT NULL, 
	organization_id VARCHAR(64) NOT NULL, 
	user_id VARCHAR(128), 
	device_id VARCHAR(128), 
	website TEXT NOT NULL, 
	domain VARCHAR(255), 
	reason TEXT, 
	status VARCHAR(32), 
	analyst VARCHAR(255), 
	resolution_note TEXT, 
	created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now(), 
	PRIMARY KEY (id)
);

CREATE INDEX ix_threat_reports_status ON threat_reports (status);

CREATE UNIQUE INDEX ix_threat_reports_report_id ON threat_reports (report_id);

CREATE INDEX ix_threat_reports_organization_id ON threat_reports (organization_id);

CREATE INDEX ix_tr_org_status ON threat_reports (organization_id, status);

CREATE INDEX ix_threat_reports_created_at ON threat_reports (created_at);

CREATE TABLE users (
	id SERIAL NOT NULL, 
	organization_id VARCHAR(64) NOT NULL, 
	email VARCHAR(255) NOT NULL, 
	password_hash VARCHAR(255) NOT NULL, 
	full_name VARCHAR(255) NOT NULL, 
	role VARCHAR(50) NOT NULL, 
	department VARCHAR(255), 
	account_status VARCHAR(50), 
	approved_by INTEGER, 
	status_reason TEXT, 
	is_active BOOLEAN, 
	last_login TIMESTAMP WITHOUT TIME ZONE, 
	created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now(), 
	PRIMARY KEY (id)
);

CREATE INDEX ix_users_organization_id ON users (organization_id);

CREATE UNIQUE INDEX ix_users_email ON users (email);

CREATE INDEX ix_users_org_dept ON users (organization_id, department);

CREATE TABLE website_scans (
	id SERIAL NOT NULL, 
	scan_id VARCHAR(128) NOT NULL, 
	organization_id VARCHAR(64) NOT NULL, 
	user_id INTEGER, 
	device_id VARCHAR(128), 
	url TEXT NOT NULL, 
	domain VARCHAR(255), 
	scan_type VARCHAR(50), 
	risk_score INTEGER, 
	confidence FLOAT, 
	threat_type VARCHAR(100), 
	verdict VARCHAR(20), 
	decision VARCHAR(20), 
	modules_used TEXT, 
	top_factors TEXT, 
	scan_duration_ms FLOAT, 
	from_cache BOOLEAN, 
	created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now(), 
	PRIMARY KEY (id)
);

CREATE INDEX ix_website_scans_risk_score ON website_scans (risk_score);

CREATE INDEX ix_website_scans_verdict ON website_scans (verdict);

CREATE INDEX ix_ws_verdict_org ON website_scans (verdict, organization_id);

CREATE INDEX ix_website_scans_user_id ON website_scans (user_id);

CREATE INDEX ix_website_scans_created_at ON website_scans (created_at);

CREATE INDEX ix_website_scans_domain ON website_scans (domain);

CREATE UNIQUE INDEX ix_website_scans_scan_id ON website_scans (scan_id);

CREATE INDEX ix_ws_org_created ON website_scans (organization_id, created_at);

CREATE INDEX ix_website_scans_organization_id ON website_scans (organization_id);

CREATE TABLE xai_reports (
	id SERIAL NOT NULL, 
	xai_id VARCHAR(128) NOT NULL, 
	scan_id VARCHAR(128), 
	organization_id VARCHAR(64), 
	module VARCHAR(64), 
	summary TEXT, 
	explanation TEXT, 
	recommendation TEXT, 
	llm_model VARCHAR(128), 
	response_time FLOAT, 
	created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now(), 
	PRIMARY KEY (id)
);

CREATE INDEX ix_xai_reports_scan_id ON xai_reports (scan_id);

CREATE UNIQUE INDEX ix_xai_reports_xai_id ON xai_reports (xai_id);


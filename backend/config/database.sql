-- College Bus Tracking System Database Schema
-- PostgreSQL with PostGIS extension for geospatial queries

-- Enable PostGIS extension for geospatial operations
CREATE EXTENSION IF NOT EXISTS "postgis";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table (supports all roles: admin, driver, passenger)
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'driver', 'passenger')),
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Buses table
CREATE TABLE buses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    bus_number VARCHAR(20) UNIQUE NOT NULL,
    bus_name VARCHAR(255),
    capacity INTEGER NOT NULL DEFAULT 50,
    is_active BOOLEAN DEFAULT true,
    driver_id UUID REFERENCES users(id) ON DELETE SET NULL,
    current_route_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Routes table (contains route coordinates as array)
CREATE TABLE routes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    -- Store route coordinates as PostGIS geometry (LINESTRING)
    route_geometry GEOMETRY(LINESTRING, 4326),
    -- Alternative: Store as array of coordinates for simpler queries
    coordinates JSONB, -- Array of {lat, lng} objects
    distance_km DECIMAL(10,2),
    estimated_duration_minutes INTEGER,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Bus stops table
CREATE TABLE bus_stops (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    location GEOMETRY(POINT, 4326) NOT NULL, -- PostGIS point
    latitude DECIMAL(10,8) NOT NULL,
    longitude DECIMAL(11,8) NOT NULL,
    stop_order INTEGER NOT NULL,
    route_id UUID NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
    estimated_arrival_time TIME, -- Expected arrival time at this stop
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(route_id, stop_order)
);

-- Live bus locations table (current position of active buses)
CREATE TABLE live_bus_locations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    bus_id UUID NOT NULL REFERENCES buses(id) ON DELETE CASCADE,
    driver_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    location GEOMETRY(POINT, 4326) NOT NULL,
    latitude DECIMAL(10,8) NOT NULL,
    longitude DECIMAL(11,8) NOT NULL,
    speed_kmh DECIMAL(5,2), -- Speed in km/h
    heading DECIMAL(5,2), -- Direction in degrees (0-360)
    accuracy_meters DECIMAL(6,2), -- GPS accuracy
    is_location_sharing BOOLEAN DEFAULT true,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    -- Track current trip
    current_route_id UUID REFERENCES routes(id),
    next_stop_id UUID REFERENCES bus_stops(id),
    distance_to_next_stop DECIMAL(10,2), -- in meters
    eta_to_next_stop TIMESTAMP WITH TIME ZONE,
    trip_started_at TIMESTAMP WITH TIME ZONE,
    UNIQUE(bus_id) -- Only one live location per bus
);

-- Historical trip logs (for analytics and reporting)
CREATE TABLE trip_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    bus_id UUID NOT NULL REFERENCES buses(id) ON DELETE CASCADE,
    driver_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    route_id UUID NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
    started_at TIMESTAMP WITH TIME ZONE NOT NULL,
    ended_at TIMESTAMP WITH TIME ZONE,
    total_distance_km DECIMAL(10,2),
    total_duration_minutes INTEGER,
    average_speed_kmh DECIMAL(5,2),
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Location history (store location points for trip replay and analytics)
CREATE TABLE location_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    trip_log_id UUID NOT NULL REFERENCES trip_logs(id) ON DELETE CASCADE,
    bus_id UUID NOT NULL REFERENCES buses(id) ON DELETE CASCADE,
    location GEOMETRY(POINT, 4326) NOT NULL,
    latitude DECIMAL(10,8) NOT NULL,
    longitude DECIMAL(11,8) NOT NULL,
    speed_kmh DECIMAL(5,2),
    heading DECIMAL(5,2),
    accuracy_meters DECIMAL(6,2),
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
-- Users table indexes
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_active ON users(is_active);

-- Buses table indexes
CREATE INDEX idx_buses_bus_number ON buses(bus_number);
CREATE INDEX idx_buses_driver_id ON buses(driver_id);
CREATE INDEX idx_buses_active ON buses(is_active);

-- Routes table indexes
CREATE INDEX idx_routes_active ON routes(is_active);
CREATE INDEX idx_routes_geometry ON routes USING GIST(route_geometry);

-- Bus stops indexes
CREATE INDEX idx_bus_stops_route_id ON bus_stops(route_id);
CREATE INDEX idx_bus_stops_location ON bus_stops USING GIST(location);
CREATE INDEX idx_bus_stops_route_order ON bus_stops(route_id, stop_order);

-- Live bus locations indexes (critical for real-time queries)
CREATE INDEX idx_live_bus_locations_bus_id ON live_bus_locations(bus_id);
CREATE INDEX idx_live_bus_locations_location ON live_bus_locations USING GIST(location);
CREATE INDEX idx_live_bus_locations_last_updated ON live_bus_locations(last_updated);
CREATE INDEX idx_live_bus_locations_sharing ON live_bus_locations(is_location_sharing);

-- Trip logs indexes
CREATE INDEX idx_trip_logs_bus_id ON trip_logs(bus_id);
CREATE INDEX idx_trip_logs_driver_id ON trip_logs(driver_id);
CREATE INDEX idx_trip_logs_route_id ON trip_logs(route_id);
CREATE INDEX idx_trip_logs_status ON trip_logs(status);
CREATE INDEX idx_trip_logs_date_range ON trip_logs(started_at, ended_at);

-- Location history indexes
CREATE INDEX idx_location_history_trip_log_id ON location_history(trip_log_id);
CREATE INDEX idx_location_history_bus_id ON location_history(bus_id);
CREATE INDEX idx_location_history_recorded_at ON location_history(recorded_at);
CREATE INDEX idx_location_history_location ON location_history USING GIST(location);

-- Triggers for updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_buses_updated_at BEFORE UPDATE ON buses FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_routes_updated_at BEFORE UPDATE ON routes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_bus_stops_updated_at BEFORE UPDATE ON bus_stops FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Sample seed data
-- Insert admin user
INSERT INTO users (email, password_hash, role, name, phone) VALUES
('admin@college.edu', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'admin', 'System Administrator', '+1234567890');

-- Insert sample routes (coordinates represent a sample college route)
INSERT INTO routes (name, description, coordinates, distance_km, estimated_duration_minutes) VALUES
('Main Campus Route', 'Route connecting main campus to residential areas', '[
    {"lat": 12.9716, "lng": 77.5946},
    {"lat": 12.9720, "lng": 77.5950},
    {"lat": 12.9730, "lng": 77.5960},
    {"lat": 12.9740, "lng": 77.5970},
    {"lat": 12.9750, "lng": 77.5980}
]'::jsonb, 5.5, 25);

-- Insert sample bus stops for the route
INSERT INTO bus_stops (name, latitude, longitude, stop_order, route_id, estimated_arrival_time) VALUES
('Main Gate', 12.9716, 77.5946, 1, (SELECT id FROM routes WHERE name = 'Main Campus Route'), '08:00:00'),
('Library Stop', 12.9720, 77.5950, 2, (SELECT id FROM routes WHERE name = 'Main Campus Route'), '08:05:00'),
('Cafeteria Stop', 12.9730, 77.5960, 3, (SELECT id FROM routes WHERE name = 'Main Campus Route'), '08:10:00'),
('Hostel Stop', 12.9740, 77.5970, 4, (SELECT id FROM routes WHERE name = 'Main Campus Route'), '08:15:00'),
('Residential Area', 12.9750, 77.5980, 5, (SELECT id FROM routes WHERE name = 'Main Campus Route'), '08:20:00');

-- Insert sample buses
INSERT INTO buses (bus_number, bus_name, capacity) VALUES
('BUS001', 'College Express 1', 50),
('BUS002', 'College Express 2', 45),
('BUS003', 'College Express 3', 50);

-- Insert sample driver
INSERT INTO users (email, password_hash, role, name, phone) VALUES
('driver1@college.edu', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'driver', 'John Driver', '+1234567891');

-- Insert sample passenger
INSERT INTO users (email, password_hash, role, name, phone) VALUES
('passenger1@college.edu', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'passenger', 'Jane Student', '+1234567892');

-- Assign driver to bus
UPDATE buses SET driver_id = (SELECT id FROM users WHERE email = 'driver1@college.edu') WHERE bus_number = 'BUS001';

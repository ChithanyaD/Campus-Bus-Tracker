# College Bus Tracking System

A comprehensive real-time bus tracking system built for colleges with live GPS tracking, ETA calculations, and multi-role user management.

## 🚀 Features

### Core Functionality
- **Real-time GPS Tracking**: Live location updates every 5-10 seconds
- **ETA Calculation**: Smart ETA using Haversine formula and speed analysis
- **Multi-role System**: Admin, Driver, and Passenger roles
- **Route Management**: Create and manage bus routes with stops
- **WebSocket Communication**: Real-time updates via Socket.IO
- **Responsive Design**: Mobile-first design with Tailwind CSS

### Technical Features
- **JWT Authentication**: Secure token-based authentication
- **SQLite Database**: Simple and reliable data storage (easily switchable to PostgreSQL)
- **RESTful APIs**: Well-documented API endpoints
- **Rate Limiting**: Protection against abuse
- **Input Validation**: Comprehensive validation using Joi and Express Validator
- **Open Source Maps**: Leaflet with OpenStreetMap tiles (no API keys required)
- **Native GPS**: Direct browser geolocation API access

## 🏗️ System Architecture

### Backend (Node.js + Express)
- **Authentication**: JWT-based with role-based access control
- **Real-time**: Socket.IO for live location updates
- **Database**: SQLite with Sequelize ORM (easily switchable to PostgreSQL)
- **API**: RESTful endpoints with proper error handling
- **Security**: Helmet, CORS, rate limiting, input validation

### Frontend (React + Vite)
- **Routing**: React Router with protected routes
- **State Management**: React Context for authentication
- **UI**: Tailwind CSS with custom components
- **Real-time**: Socket.IO client for live updates
- **Maps**: Open source Leaflet maps with OpenStreetMap tiles

### Database Schema
- **Users**: Multi-role user management
- **Buses**: Bus information and assignments
- **Routes**: Route definitions with coordinates
- **Bus Stops**: Stop locations and order
- **Live Locations**: Real-time bus positions
- **Trip Logs**: Historical trip data

## 📋 Prerequisites

- **Node.js** 18.0.0 or higher
- **SQLite** (comes pre-installed with Node.js)
- **npm** or **yarn** package manager
- **Modern web browser** with GPS support (Chrome, Firefox, Safari, Edge)
- **Google Maps API Key** (for map functionality)

## 🚀 Quick Start

### 1. Clone the Repository
```bash
git clone https://github.com/your-username/college-bus-tracker.git
cd college-bus-tracker
```

### 2. Backend Setup

#### Install Dependencies
```bash
cd backend
npm install
```

#### Database Setup
```bash
# SQLite database will be created automatically in backend/data/college_bus_tracker.db
# No manual database setup required - tables are created via Sequelize migrations
```

#### Environment Configuration
```bash
cp env.example .env
```

Edit `.env` file with your configuration:
```env
# Database (SQLite - no additional configuration needed)
USE_SQLITE=true

# JWT
JWT_SECRET=college_bus_tracker_jwt_secret_key_2024_change_in_production
JWT_EXPIRE=24h

# Server
PORT=3004
NODE_ENV=development

# Frontend
FRONTEND_URL=http://localhost:3000

# Socket.IO
SOCKET_CORS_ORIGIN=http://localhost:3000

# Google Maps (get from Google Cloud Console)
GOOGLE_MAPS_API_KEY=your_google_maps_api_key
```

#### Start Backend Server
```bash
npm run dev
```

### 3. Frontend Setup

#### Install Dependencies
```bash
cd ../frontend
npm install
```

#### Start Development Server
```bash
npm run dev
```

### 4. Access the Application

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:3004
- **API Documentation**: http://localhost:3004/api

## 👥 User Roles & Permissions

### Admin
- **Dashboard**: System overview with statistics
- **User Management**: Create, update, delete users
- **Bus Management**: Add/edit buses, assign drivers
- **Route Management**: Create routes and bus stops
- **Live Monitoring**: View all active buses
- **System Settings**: Configure system parameters

### Driver
- **Dashboard**: Personal bus information
- **Location Sharing**: Start/stop GPS tracking
- **Route Selection**: Choose active route
- **Trip Management**: View trip history
- **Real-time Updates**: Send location data

### Passenger
- **Dashboard**: Select and track buses
- **Live Tracking**: View bus locations on map
- **ETA Display**: Real-time arrival estimates
- **Route Information**: View stops and schedules
- **Notifications**: Arrival alerts

## 🔑 Default Credentials

### Admin Account
- **Email**: admin@college.edu
- **Password**: password

### Driver Account
- **Email**: driver1@college.edu
- **Password**: password

### Passenger Account
- **Email**: passenger1@college.edu
- **Password**: password

## 📡 API Documentation

### Authentication Endpoints

#### POST /api/auth/login
Login user and receive JWT token.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "password"
}
```

**Response:**
```json
{
  "message": "Login successful",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "User Name",
    "role": "passenger"
  },
  "token": "jwt_token_here"
}
```

#### POST /api/auth/register
Register new user (admin only).

#### GET /api/auth/profile
Get current user profile.

### Bus Management

#### GET /api/buses
Get all buses (filtered by role).

#### POST /api/buses
Create new bus (admin only).

#### PUT /api/buses/:id
Update bus information (admin only).

#### PUT /api/buses/:id/assign-driver
Assign driver to bus (admin only).

### Location Tracking

#### GET /api/locations
Get all active bus locations.

#### GET /api/locations/bus/:busId
Get specific bus location.

#### POST /api/locations/start
Start location sharing (driver only).

#### POST /api/locations/stop
Stop location sharing (driver only).

#### PUT /api/locations/update
Update bus location (driver only).

### Route Management

#### GET /api/routes
Get all routes.

#### POST /api/routes
Create new route (admin only).

#### GET /api/routes/:routeId/stops
Get bus stops for a route.

#### POST /api/routes/:routeId/stops
Add bus stop to route (admin only).

## 🔧 Environment Variables

### Backend (.env)
```env
# Database Configuration (SQLite)
USE_SQLITE=true

# JWT Configuration
JWT_SECRET=college_bus_tracker_jwt_secret_key_2024_change_in_production
JWT_EXPIRE=24h

# Server Configuration
PORT=3004
NODE_ENV=development

# CORS Configuration
FRONTEND_URL=http://localhost:3000

# Socket.IO Configuration
SOCKET_CORS_ORIGIN=http://localhost:3000

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Logging
LOG_LEVEL=info
```

### Frontend
The frontend uses the backend API proxy configured in `vite.config.js`.

## 🚀 Deployment

### Backend Deployment

#### 1. Production Environment Setup
```bash
# Set NODE_ENV to production
NODE_ENV=production

# Use a production JWT secret
JWT_SECRET=your_production_secret_key

# Configure production database (switch to PostgreSQL if needed)
# USE_SQLITE=false
# DB_HOST=your_production_db_host
# DB_PASSWORD=your_production_db_password
```

#### 2. Build and Start
```bash
npm run build
npm start
```

#### 3. Process Manager (PM2)
```bash
npm install -g pm2
pm2 start server.js --name "bus-tracker-backend"
pm2 startup
pm2 save
```

### Frontend Deployment

#### 1. Build for Production
```bash
npm run build
```

#### 2. Serve Static Files
Deploy the `dist` folder to your web server (nginx, Apache, etc.)

#### 3. Environment Variables
Update the Google Maps API key in `index.html`:
```html
<script async defer src="https://maps.googleapis.com/maps/api/js?key=YOUR_PRODUCTION_API_KEY&libraries=places,geometry"></script>
```

## 🛡️ Security Features

- **JWT Authentication**: Secure token-based auth
- **Password Hashing**: bcrypt with 12 salt rounds
- **Rate Limiting**: 100 requests per 15 minutes per IP
- **Input Validation**: Comprehensive validation on all inputs
- **CORS**: Configured for allowed origins

## 🔧 Troubleshooting

### White Page Issues
If you see a white page instead of the login page:

1. **Backend Port Mismatch**: Ensure backend is running on port 3004
   ```bash
   # Check if backend is running
   curl http://localhost:3004/health
   ```

2. **Frontend Proxy Configuration**: Frontend automatically proxies to backend
   - Frontend runs on port 3000 (or next available)
   - Backend runs on port 3004
   - No manual configuration needed

3. **Environment Variables**: Set `VITE_BACKEND_URL` if using custom ports
   ```env
   VITE_BACKEND_URL=http://localhost:3004
   ```

4. **Clear Browser Cache**: Hard refresh with `Ctrl+Shift+R`

### GPS Location Issues
For mobile GPS access:
- Ensure HTTPS in production (required for geolocation)
- Grant location permissions when prompted
- Use modern browsers (Chrome, Firefox, Safari, Edge)
- **Helmet**: Security headers
- **SQL Injection Protection**: Sequelize ORM
- **XSS Protection**: React's built-in protection

## 🔍 Monitoring & Logging

### Health Check
```
GET /health
```

### System Statistics
- Active buses count
- Connected users
- API request rates
- Database connection status

### Logging
- Winston logger with configurable levels
- Request/response logging
- Error tracking
- Performance monitoring

## 🐛 Troubleshooting

### Common Issues

#### Database Connection Issues
```bash
# For PostgreSQL (if switching from SQLite):
# sudo systemctl status postgresql

# Test connection
psql -h localhost -U your_user -d college_bus_tracker
```

#### Port Already in Use
```bash
# Find process using port
lsof -i :3004  # Backend
lsof -i :3000  # Frontend

# Kill process
kill -9 PID
```

#### Geolocation Not Working
- Ensure HTTPS in production (required for geolocation)
- Check browser permissions
- Verify GPS sensor access

#### Socket.IO Connection Issues
- Check CORS configuration
- Verify Socket.IO client version compatibility
- Check firewall settings

## 📈 Performance Optimization

### Database
- SQLite spatial functions for location queries (can be upgraded to PostGIS)
- Connection pooling with Sequelize
- Query optimization with proper indexing

### Backend
- Compression middleware
- Rate limiting
- Efficient caching strategies
- Background job processing for heavy tasks

### Frontend
- Code splitting with Vite
- Lazy loading of components
- Optimized bundle size
- Efficient re-rendering with React.memo

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 📞 Support

For support and questions:
- Create an issue on GitHub
- Check the troubleshooting section
- Review the API documentation

## 🎯 Future Enhancements

- [ ] Push notifications for ETA updates
- [ ] Historical route analytics
- [ ] Mobile app (React Native)
- [ ] Offline support
- [ ] Multi-language support
- [ ] Advanced reporting dashboard
- [ ] Integration with college systems
- [ ] Emergency alert system
- [ ] Fuel consumption tracking
- [ ] Maintenance scheduling

---

Built with ❤️ for college communities

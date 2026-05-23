
import React, { useEffect, useState } from 'react';
import { MapPin, Navigation, Search, Layers, ZoomIn, ZoomOut, Filter, User as UserIcon, X, Map as MapIcon, History as HistoryIcon, ChevronRight, Trash2 } from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup, useMap, Polyline } from 'react-leaflet';
import L from 'leaflet';
import { ClientAccount, User } from '../types';
import { dispatchStorageEvent } from '../utils/events';

// Custom SVG Icon for Leaflet
const createCustomIcon = (color: string, iconType: 'client' | 'user' = 'client') => {
  return L.divIcon({
    html: `<div style="background-color: ${color}; width: 30px; height: 30px; border-radius: 50% 50% 50% 0; transform: rotate(-45deg); display: flex; align-items: center; justify-center; border: 2px solid white; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);">
            <div style="transform: rotate(45deg); color: white; display: flex; align-items: center; justify-content: center; width: 100%; height: 100%;">
              ${iconType === 'client' 
                ? '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>'
                : '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>'
              }
            </div>
          </div>`,
    className: 'custom-div-icon',
    iconSize: [30, 30],
    iconAnchor: [15, 30],
    popupAnchor: [0, -30]
  });
};

const RecenterMap: React.FC<{ lat: number; lng: number }> = ({ lat, lng }) => {
  const map = useMap();
  useEffect(() => {
    map.setView([lat, lng], 13);
  }, [lat, lng, map]);
  return null;
};

const GeographicMap: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'map' | 'report'>('map');
  const [trajetsEnabled, setTrajetsEnabled] = useState(() => {
    const savedConfig = localStorage.getItem('microfox_mf_config');
    if (savedConfig) {
      try {
        const config = JSON.parse(savedConfig);
        return config.gpsTrackingEnabled !== false;
      } catch (e) {}
    }
    return true;
  });
  const [userLocation, setUserLocation] = useState<{lat: number, lng: number} | null>(null);
  const [map, setMap] = useState<L.Map | null>(null);
  const [clients, setClients] = useState<ClientAccount[]>([]);
  const [otherUsers, setOtherUsers] = useState<User[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [routeCoordinates, setRouteCoordinates] = useState<[number, number][] | null>(null);
  const [isRouting, setIsRouting] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [journeys, setJourneys] = useState<any[]>([]);
  const [startDate, setStartDate] = useState<string>(new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState<string>(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    const handleStorageChange = () => {
      const savedConfig = localStorage.getItem('microfox_mf_config');
      if (savedConfig) {
        try {
          const config = JSON.parse(savedConfig);
          setTrajetsEnabled(config.gpsTrackingEnabled !== false);
        } catch (e) {}
      }
    };
    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('microfox_storage' as any, handleStorageChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('microfox_storage' as any, handleStorageChange);
    };
  }, []);

  useEffect(() => {
    // Load current user
    const savedUser = localStorage.getItem('microfox_current_user');
    if (savedUser) {
      setCurrentUser(JSON.parse(savedUser));
    }

    // Load clients from localStorage
    const storedClients = localStorage.getItem('microfox_members_data');
    if (storedClients) {
      try {
        const parsedClients = JSON.parse(storedClients);
        const user = savedUser ? JSON.parse(savedUser) : {};
        
        let filteredClientsData = parsedClients;
        if (user.role === 'agent commercial') {
          const agentZones = user.zonesCollecte || (user.zoneCollecte ? [user.zoneCollecte] : []);
          if (agentZones.length > 0) {
            filteredClientsData = parsedClients.filter((c: any) => agentZones.includes(c.zone));
          }
        }

        setClients(filteredClientsData.filter((c: ClientAccount) => c.latitude !== null && c.latitude !== undefined && c.longitude !== null && c.longitude !== undefined));
      } catch (e) {
        console.error("Error parsing clients", e);
      }
    }

    // Load other users for admins/directors
    const savedUsers = localStorage.getItem('microfox_users');
    if (savedUsers) {
      try {
        const users: User[] = JSON.parse(savedUsers);
        const user = savedUser ? JSON.parse(savedUser) : {};
        
        if (user.role === 'administrateur' || user.role === 'directeur') {
          // Exclude admins and current user
          setOtherUsers(users.filter(u => 
            u.role !== 'administrateur' && 
            u.id !== user.id && 
            u.latitude !== null && 
            u.latitude !== undefined
          ));
        }
      } catch (e) {
        console.error("Error parsing users", e);
      }
    }

    // Load journeys
    const savedJourneys = localStorage.getItem('microfox_user_journeys');
    if (savedJourneys) {
      try {
        const parsedJourneys = JSON.parse(savedJourneys);
        const twoWeeksAgo = Date.now() - (14 * 24 * 60 * 60 * 1000);
        const filteredJourneys = parsedJourneys.filter((p: any) => new Date(p.timestamp).getTime() > twoWeeksAgo);
        
        if (filteredJourneys.length !== parsedJourneys.length) {
          localStorage.setItem('microfox_user_journeys', JSON.stringify(filteredJourneys));
        }
        setJourneys(filteredJourneys);
      } catch (e) {
        console.error("Error parsing journeys", e);
      }
    }

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
        },
        () => console.log("Géolocalisation refusée ou indisponible.")
      );
    }
  }, []);

  const fetchRoute = async (destLat: number, destLng: number) => {
    if (!userLocation) {
      alert("Position actuelle non disponible.");
      return;
    }

    setIsRouting(true);
    try {
      const response = await fetch(
        `https://router.project-osrm.org/route/v1/driving/${userLocation.lng},${userLocation.lat};${destLng},${destLat}?overview=full&geometries=geojson`
      );
      const data = await response.json();
      
      if (data.routes && data.routes.length > 0) {
        const coords = data.routes[0].geometry.coordinates.map((coord: [number, number]) => [coord[1], coord[0]]);
        setRouteCoordinates(coords);
      } else {
        alert("Impossible de tracer l'itinéraire.");
      }
    } catch (error) {
      console.error("Error fetching route:", error);
      alert("Erreur lors de la récupération de l'itinéraire.");
    } finally {
      setIsRouting(false);
    }
  };

  const filteredClients = clients.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (c.epargneAccountNumber && c.epargneAccountNumber.toLowerCase().includes(searchQuery.toLowerCase())) ||
    c.tontineAccounts.some(ta => ta.number.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const filteredOtherUsers = otherUsers.filter(u => 
    u.identifiant.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.role.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Group journeys by user
  const groupedJourneys = journeys
    .filter((point: any) => {
      const pointDate = point.timestamp.split('T')[0];
      return pointDate >= startDate && pointDate <= endDate;
    })
    .reduce((acc: any, point: any) => {
      if (!acc[point.userId]) {
        acc[point.userId] = {
          userId: point.userId,
          userName: point.userName,
          points: []
        };
      }
      acc[point.userId].points.push(point);
      return acc;
    }, {});

  const journeyList = Object.values(groupedJourneys);

  const handleDeleteUserHistory = (userId: string) => {
    if (!currentUser || !['administrateur', 'directeur'].includes(currentUser.role)) return;
    if (!window.confirm("Voulez-vous vraiment supprimer l'historique de cet utilisateur ?")) return;
    const updated = journeys.filter(p => p.userId !== userId);
    localStorage.setItem('microfox_user_journeys', JSON.stringify(updated));
    setJourneys(updated);
  };

  const handleDeleteAllHistory = () => {
    if (!currentUser || !['administrateur', 'directeur'].includes(currentUser.role)) return;
    if (!window.confirm("Voulez-vous vraiment supprimer tout l'historique des trajets ?")) return;
    localStorage.setItem('microfox_user_journeys', JSON.stringify([]));
    setJourneys([]);
  };

  const handleDeletePoint = (userId: string, timestamp: string) => {
    if (!currentUser || !['administrateur', 'directeur'].includes(currentUser.role)) return;
    if (!window.confirm("Supprimer ce point ?")) return;
    const updated = journeys.filter(p => !(p.userId === userId && p.timestamp === timestamp));
    localStorage.setItem('microfox_user_journeys', JSON.stringify(updated));
    setJourneys(updated);
  };

  return (
    <div className="h-full flex flex-col space-y-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-white uppercase tracking-tight">
            Carte<br />Géographique
          </h1>
          <p className="text-gray-400 text-sm font-medium mt-1">
            Géo-localisation des clients et points de collecte
          </p>
        </div>

        <div className="flex items-center gap-2">
          {routeCoordinates && (
            <button 
              onClick={() => setRouteCoordinates(null)}
              className="px-4 py-2 bg-red-50 text-red-600 border border-red-100 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-red-100 transition-colors shadow-sm"
            >
              Effacer l'itinéraire
            </button>
          )}
            <div className="relative flex-1 sm:flex-none">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" size={18} />
            <input 
              type="text" 
              placeholder="Nom, Compte, Tontine..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-xl text-base text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#00c896] w-full sm:w-64 shadow-sm font-bold"
            />
          </div>
        </div>
      </div>

      <div className="flex-1 bg-white rounded-[2rem] border border-gray-200 shadow-sm relative overflow-hidden min-h-[500px] z-0">
          <MapContainer 
            ref={setMap}
            center={userLocation ? [userLocation.lat, userLocation.lng] : [6.13, 1.22]} 
            zoom={13} 
            style={{ height: '100%', width: '100%' }}
            zoomControl={false}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            
            {userLocation && currentUser?.role !== 'administrateur' && (
              <Marker position={[userLocation.lat, userLocation.lng]} icon={createCustomIcon('#2563eb', 'user')}>
                <Popup>Votre position actuelle</Popup>
              </Marker>
            )}

            {routeCoordinates && (
              <Polyline positions={routeCoordinates} color="#2563eb" weight={5} opacity={0.7} />
            )}

            {filteredClients.map((client) => (
              <Marker 
                key={client.id} 
                position={[client.latitude!, client.longitude!]}
                icon={createCustomIcon(client.status === 'Actif' ? '#10b981' : '#f59e0b', 'client')}
              >
                <Popup>
                  <div className="p-1 min-w-[150px]">
                    <div className="flex items-center gap-2 mb-2 border-b pb-1">
                      <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                        <UserIcon size={14} />
                      </div>
                      <div>
                        <p className="text-xs font-black text-[#121c32] uppercase leading-tight">{client.name}</p>
                        <p className="text-[9px] font-bold text-gray-600 uppercase">{client.code}</p>
                      </div>
                    </div>
                    <div className="space-y-1 mb-3">
                      <p className="text-[10px] text-gray-600 flex justify-between">
                        <span>Épargne:</span>
                        <span className="font-bold">{client.balances.epargne.toLocaleString()} F</span>
                      </p>
                      <p className="text-[10px] text-gray-600 flex justify-between">
                        <span>Status:</span>
                        <span className={`font-bold ${client.status === 'Actif' ? 'text-emerald-600' : 'text-amber-600'}`}>{client.status}</span>
                      </p>
                    </div>
                    {routeCoordinates ? (
                      <button 
                        onClick={() => setRouteCoordinates(null)}
                        className="w-full py-2 bg-red-50 text-red-600 border border-red-100 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-red-100 transition-all active:scale-95 flex items-center justify-center gap-2"
                      >
                        <X size={12} />
                        Effacer l'itinéraire
                      </button>
                    ) : (
                      <button 
                        onClick={() => fetchRoute(client.latitude!, client.longitude!)}
                        disabled={isRouting}
                        className="w-full py-2 bg-blue-600 text-white rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-blue-700 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        <Navigation size={12} />
                        {isRouting ? 'Calcul...' : 'Tracer l\'itinéraire'}
                      </button>
                    )}
                  </div>
                </Popup>
              </Marker>
            ))}

            {(currentUser?.role === 'administrateur' || currentUser?.role === 'directeur') && filteredOtherUsers.map((u) => (
              <Marker 
                key={u.id} 
                position={[u.latitude!, u.longitude!]}
                icon={createCustomIcon('#8b5cf6', 'user')}
              >
                <Popup>
                  <div className="p-1 min-w-[150px]">
                    <div className="flex items-center gap-2 mb-2 border-b pb-1">
                      <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center text-purple-600">
                        <UserIcon size={14} />
                      </div>
                      <div>
                        <p className="text-xs font-black text-[#121c32] uppercase leading-tight">{u.identifiant}</p>
                        <p className="text-[9px] font-bold text-gray-600 uppercase">{u.role}</p>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] text-gray-600 flex justify-between">
                        <span>Dernière MAJ:</span>
                        <span className="font-bold">{u.lastUpdate ? new Date(u.lastUpdate).toLocaleTimeString() : 'N/A'}</span>
                      </p>
                    </div>
                  </div>
                </Popup>
              </Marker>
            ))}

            {userLocation && !routeCoordinates && <RecenterMap lat={userLocation.lat} lng={userLocation.lng} />}
          </MapContainer>

          {/* Legend */}
          <div className="absolute top-6 left-6 bg-white/90 backdrop-blur-md p-4 rounded-3xl border border-gray-200 shadow-xl w-48 z-[1000]">
            <div className="flex items-center gap-2 mb-3">
              <Layers size={16} className="text-gray-600" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-gray-700">Légende</span>
            </div>
            <div className="space-y-2">
              {currentUser?.role !== 'administrateur' && (
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-blue-600"></div>
                  <span className="text-[10px] font-medium text-gray-600">Votre position</span>
                </div>
              )}
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500"></div>
                <span className="text-[10px] font-medium text-gray-600">Client Actif</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-amber-500"></div>
                <span className="text-[10px] font-medium text-gray-600">Client Inactif</span>
              </div>
              {(currentUser?.role === 'administrateur' || currentUser?.role === 'directeur') && (
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-purple-500"></div>
                  <span className="text-[10px] font-medium text-gray-600">Utilisateur</span>
                </div>
              )}
            </div>
          </div>

          {/* Map Controls */}
          <div className="absolute bottom-6 right-6 flex flex-col gap-2 z-[1000]">
            <button 
              onClick={() => {
                if (navigator.geolocation) {
                  navigator.geolocation.getCurrentPosition(
                    (pos) => {
                      const newLoc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
                      setUserLocation(newLoc);
                      if (map) {
                        map.flyTo([newLoc.lat, newLoc.lng], 15);
                      }
                    },
                    (err) => {
                      console.error("Geolocation error:", err);
                      alert("Impossible d'obtenir votre position. Vérifiez vos paramètres de localisation.");
                    },
                    { enableHighAccuracy: true }
                  );
                } else {
                  alert("La géolocalisation n'est pas supportée par votre navigateur.");
                }
              }}
              className="p-3 bg-[#00c896] text-white rounded-2xl shadow-lg transition-all hover:bg-[#00a87d] active:scale-95 flex items-center justify-center"
              title="Ma position"
            >
              <Navigation size={20} />
            </button>
          </div>
        </div>
      </div>
  );
};

export default GeographicMap;

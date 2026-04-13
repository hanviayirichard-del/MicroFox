
import React, { useEffect, useState } from 'react';
import { MapPin, Navigation, Search, Layers, ZoomIn, ZoomOut, Filter, User as UserIcon, X, Map as MapIcon, History, ChevronRight, Trash2 } from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup, useMap, Polyline } from 'react-leaflet';
import L from 'leaflet';
import { ClientAccount, User } from '../types';

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

        <div className="flex items-center gap-2 bg-[#121c32] p-1 rounded-2xl border border-gray-800">
          <button 
            onClick={() => setActiveTab('map')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'map' ? 'bg-[#00c896] text-white shadow-lg shadow-[#00c896]/20' : 'text-gray-400 hover:text-white'}`}
          >
            <MapIcon size={16} />
            Carte
          </button>
          {(currentUser?.role === 'administrateur' || currentUser?.role === 'directeur') && (
            <button 
              onClick={() => setActiveTab('report')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'report' ? 'bg-[#00c896] text-white shadow-lg shadow-[#00c896]/20' : 'text-gray-400 hover:text-white'}`}
            >
              <History size={16} />
              Trajets
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          {activeTab === 'map' && routeCoordinates && (
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
              placeholder={activeTab === 'map' ? "Nom, Compte, Tontine..." : "Rechercher un utilisateur..."}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-xl text-base text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#00c896] w-full sm:w-64 shadow-sm font-bold"
            />
          </div>
        </div>
      </div>

      {activeTab === 'map' ? (
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
      ) : (
        <div className="flex-1 bg-white rounded-[2rem] border-2 border-[#121c32] shadow-2xl overflow-hidden flex flex-col">
          <div className="p-3 sm:p-8 border-b-2 border-gray-100 bg-[#121c32] flex items-center justify-between">
            <div>
              <h3 className="text-lg sm:text-2xl font-black text-white uppercase tracking-tight">Rapport de Trajets</h3>
              <p className="text-[9px] sm:text-xs font-bold text-emerald-400 uppercase tracking-[0.2em] mt-0.5">Suivi des déplacements (14j)</p>
            </div>
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <div className="flex items-center gap-2 bg-[#1a2642] px-3 py-2 rounded-xl border border-gray-700">
                <Filter size={14} className="text-emerald-400" />
                <input 
                  type="date" 
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="bg-transparent text-white text-[10px] font-black uppercase focus:outline-none [color-scheme:dark]"
                />
                <span className="text-gray-500 text-[10px]">au</span>
                <input 
                  type="date" 
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="bg-transparent text-white text-[10px] font-black uppercase focus:outline-none [color-scheme:dark]"
                />
              </div>
              <div className="hidden lg:block bg-white px-4 py-2 rounded-xl border border-gray-100 shadow-sm">
                <p className="text-[10px] font-black text-[#121c32] uppercase">{new Date().toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
              </div>
              {journeyList.length > 0 && (currentUser?.role === 'administrateur' || currentUser?.role === 'directeur') && (
                <button 
                  onClick={handleDeleteAllHistory}
                  className="p-2 text-red-500 hover:bg-red-50 rounded-xl transition-all"
                  title="Supprimer tout l'historique"
                >
                  <Trash2 size={20} />
                </button>
              )}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-3 sm:p-6 space-y-4 sm:space-y-8 custom-scrollbar bg-gray-50/30">
            {journeyList.length > 0 ? (
              <div className="space-y-4 sm:space-y-8">
                {journeyList.map((journey: any) => (
                  <div key={journey.userId} className="bg-white border-2 border-gray-200 rounded-[1.2rem] sm:rounded-[2.5rem] shadow-lg overflow-hidden flex flex-col">
                    <div className="p-3 sm:p-6 border-b-2 border-gray-50 bg-gray-50/50 flex items-center justify-between">
                      <div className="flex items-center gap-2 sm:gap-4">
                        <div className="w-8 h-8 sm:w-12 h-12 rounded-lg sm:rounded-2xl bg-purple-50 flex items-center justify-center text-purple-600">
                          <UserIcon size={16} className="sm:w-6 sm:h-6" />
                        </div>
                        <div>
                          <h4 className="text-xs sm:text-base font-black text-[#121c32] uppercase leading-tight">{journey.userName}</h4>
                          <p className="text-[8px] sm:text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">ID: {journey.userId}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 sm:gap-3">
                        <span className="inline-block px-2 sm:px-4 py-1 bg-emerald-50 text-emerald-600 rounded-full text-[8px] sm:text-[10px] font-black uppercase tracking-widest">
                          {journey.points.length} Pts
                        </span>
                        {(currentUser?.role === 'administrateur' || currentUser?.role === 'directeur') && (
                          <button 
                            onClick={() => handleDeleteUserHistory(journey.userId)}
                            className="p-2 text-red-400 hover:bg-red-50 hover:text-red-600 rounded-xl transition-all"
                            title="Supprimer l'historique de cet utilisateur"
                          >
                            <Trash2 size={18} />
                          </button>
                        )}
                      </div>
                    </div>
                    
                    <div className="p-0">
                      {/* Desktop Table */}
                      <div className="hidden md:block overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="bg-gray-100/50 border-b-2 border-gray-100">
                              <th className="px-8 py-4 text-[11px] font-black text-[#121c32] uppercase tracking-[0.2em]">Heure</th>
                              <th className="px-8 py-4 text-[11px] font-black text-[#121c32] uppercase tracking-[0.2em]">Coordonnées Géographiques</th>
                              <th className="px-8 py-4 text-right text-[11px] font-black text-[#121c32] uppercase tracking-[0.2em]">Localisation</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-50">
                            {journey.points.map((point: any, idx: number) => (
                              <tr key={idx} className="hover:bg-gray-50/50 transition-colors group">
                                <td className="px-8 py-4">
                                  <div className="flex items-center gap-3">
                                    <div className="w-2 h-2 rounded-full bg-purple-500 shadow-sm shadow-purple-200"></div>
                                    <span className="text-xs font-black text-[#121c32]">
                                      {new Date(point.timestamp).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                  </div>
                                </td>
                                <td className="px-8 py-4">
                                  <span className="text-xs font-bold text-gray-600 font-mono bg-gray-100 px-2 py-1 rounded-lg">
                                    {point.lat.toFixed(6)}, {point.lng.toFixed(6)}
                                  </span>
                                </td>
                                <td className="px-8 py-4 text-right flex items-center justify-end gap-2">
                                  <a 
                                    href={`https://www.google.com/maps?q=${point.lat},${point.lng}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-2 px-4 py-2 bg-purple-50 text-purple-600 hover:bg-purple-100 rounded-xl transition-all active:scale-95 text-[10px] font-black uppercase tracking-widest"
                                  >
                                    <MapPin size={14} />
                                    Voir sur Maps
                                  </a>
                                  {(currentUser?.role === 'administrateur' || currentUser?.role === 'directeur') && (
                                    <button 
                                      onClick={() => handleDeletePoint(point.userId, point.timestamp)}
                                      className="p-2 text-red-400 hover:bg-red-50 hover:text-red-600 rounded-lg transition-all"
                                      title="Supprimer ce point"
                                    >
                                      <Trash2 size={14} />
                                    </button>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* Mobile List View */}
                      <div className="md:hidden divide-y divide-gray-100">
                        <div className="bg-gray-50/50 px-4 py-2 border-b border-gray-100">
                          <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Détails du trajet</p>
                        </div>
                        {journey.points.map((point: any, idx: number) => (
                          <div key={idx} className="p-3 space-y-2">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <div className="w-1.5 h-1.5 rounded-full bg-purple-500"></div>
                                <span className="text-[10px] font-black text-[#121c32]">
                                  {new Date(point.timestamp).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <a 
                                  href={`https://www.google.com/maps?q=${point.lat},${point.lng}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="p-1.5 bg-purple-50 text-purple-600 rounded-lg"
                                >
                                  <MapPin size={12} />
                                </a>
                                {(currentUser?.role === 'administrateur' || currentUser?.role === 'directeur') && (
                                  <button 
                                    onClick={() => handleDeletePoint(point.userId, point.timestamp)}
                                    className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg"
                                  >
                                    <Trash2 size={12} />
                                  </button>
                                )}
                              </div>
                            </div>
                            <div className="bg-gray-50 p-1.5 rounded-lg flex items-center justify-between">
                              <span className="text-[9px] font-bold text-gray-400 uppercase">Coords</span>
                              <span className="text-[10px] font-bold text-gray-700 font-mono">
                                {point.lat.toFixed(4)}, {point.lng.toFixed(4)}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center py-20">
                <div className="w-20 h-20 bg-white rounded-[2.5rem] flex items-center justify-center text-gray-200 mb-6 shadow-sm border border-gray-100">
                  <History size={40} />
                </div>
                <p className="text-gray-400 font-black uppercase text-[10px] tracking-[0.3em]">Aucun trajet enregistré pour aujourd'hui</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default GeographicMap;

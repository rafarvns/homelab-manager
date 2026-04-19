import { useState, useEffect, useMemo } from 'react';
import * as LucideIcons from 'lucide-react';
import { 
  Settings, LayoutDashboard, Server, Shield, HardDrive, 
  AlertCircle, Activity, Cpu, Clock, Globe, BarChart3, Users, Thermometer,
  Search, RefreshCcw, Play, Square, RotateCw, FileSearch, X, Filter, ChevronDown,
  Trash2, Box
} from 'lucide-react';
import { useAppStore, Server as ServerType } from '../store';
import { ServerInput } from './ServerForm';
import { SystemService, DockerContainer } from '../../../preload/index.d';

const AVAILABLE_ICONS = [
  'Server', 'Terminal', 'Database', 'Globe', 'Cpu', 
  'HardDrive', 'Cloud', 'Shield', 'Zap', 'Activity',
  'Box', 'Monitor', 'Settings', 'Wifi', 'Lock'
];

interface ServerSettingsProps {
  server: ServerType;
  isActive: boolean;
  isHidden: boolean;
}

type SettingsTab = 'dashboard' | 'services' | 'docker' | 'firewall' | 'manage';

const ServerSettings = ({ server, isActive, isHidden }: ServerSettingsProps) => {
  const [activeTab, setActiveTab] = useState<SettingsTab>('dashboard');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmValue, setDeleteConfirmValue] = useState('');
  const [saveMessage, setSaveMessage] = useState('');
  const [formData, setFormData] = useState<ServerInput>({
    name: server.name,
    host: server.host,
    port: server.port,
    username: server.username,
    auth_type: server.auth_type,
    password: server.password || '',
    private_key_path: server.private_key_path || '',
    passphrase: server.passphrase || '',
    icon: server.icon || 'Server',
    auto_refresh_services: server.auto_refresh_services || false
  });

  const { fetchServers, switchServerContext } = useAppStore();
  const [sysInfo, setSysInfo] = useState<any>(null);
  const [sysInfoLoading, setSysInfoLoading] = useState(false);
  const [sysInfoError, setSysInfoError] = useState('');

  const [services, setServices] = useState<SystemService[]>([]);
  const [servicesLoading, setServicesLoading] = useState(false);
  const [servicesError, setServicesError] = useState('');
  const [servicesSearch, setServicesSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [enabledFilter, setEnabledFilter] = useState<string>('all');
  const [selectedServiceLogs, setSelectedServiceLogs] = useState<{name: string, content: string} | null>(null);
  const [logsLoading, setLogsLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const [containers, setContainers] = useState<DockerContainer[]>([]);
  const [containersLoading, setContainersLoading] = useState(false);
  const [containersError, setContainersError] = useState('');
  const [containersSearch, setContainersSearch] = useState('');
  const [dockerStatusFilter, setDockerStatusFilter] = useState<string>('all');
  const [selectedContainerLogs, setSelectedContainerLogs] = useState<{name: string, content: string} | null>(null);
  const [containerActionLoading, setContainerActionLoading] = useState<string | null>(null);
  const [containerActionError, setContainerActionError] = useState<string | null>(null);
  const [deleteContainerConfirm, setDeleteContainerConfirm] = useState<string | null>(null);

  useEffect(() => {
    setFormData({
      name: server.name,
      host: server.host,
      port: server.port,
      username: server.username,
      auth_type: server.auth_type,
      password: server.password || '',
      private_key_path: server.private_key_path || '',
      passphrase: server.passphrase || '',
      icon: server.icon || 'Server',
      auto_refresh_services: server.auto_refresh_services || false
    });
  }, [server]);

  useEffect(() => {
    if (isActive && !isHidden) {
      if (activeTab === 'dashboard') loadSysInfo();
      if (activeTab === 'services') loadServices();
      if (activeTab === 'docker') loadContainers();
    }
  }, [isActive, isHidden, activeTab, server.id]);

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (isActive && !isHidden && activeTab === 'services' && server.auto_refresh_services) {
      interval = setInterval(() => {
        loadServices(true); // silent refresh
      }, 30000);
    }
    return () => { if (interval) clearInterval(interval); };
  }, [isActive, isHidden, activeTab, server.id, server.auto_refresh_services]);

  const loadSysInfo = async () => {
    setSysInfoLoading(true);
    setSysInfoError('');
    try {
      const data = await window.api.serverSysInfo(server.id);
      setSysInfo(data);
    } catch (err: any) {
      console.error('Failed to load sysinfo', err);
      setSysInfoError(err.message || 'Failed to connect and fetch data');
    } finally {
      setSysInfoLoading(false);
    }
  };

  const loadServices = async (silent = false) => {
    if (!silent) setServicesLoading(true);
    setServicesError('');
    try {
      const data = await window.api.servicesList(server.id);
      setServices(data);
    } catch (err: any) {
      console.error('Failed to load services', err);
      if (!silent) setServicesError(err.message || 'Failed to fetch services');
    } finally {
      if (!silent) setServicesLoading(false);
    }
  };

  const handleServiceAction = async (serviceName: string, action: 'start' | 'stop' | 'restart') => {
    setActionLoading(`${serviceName}-${action}`);
    setActionError(null);
    try {
      await window.api.servicesControl(server.id, serviceName, action);
      await loadServices(true);
      // If we are looking at logs of this service, refresh them too
      if (selectedServiceLogs?.name === serviceName) {
        handleViewLogs(serviceName);
      }
    } catch (err: any) {
      console.error(`Failed to ${action} ${serviceName}`, err);
      setActionError(`Failed to ${action} ${serviceName}: ${err.message}`);
      setTimeout(() => setActionError(null), 5000);
    } finally {
      setActionLoading(null);
    }
  };

  const handleViewLogs = async (serviceName: string) => {
    setLogsLoading(true);
    try {
      const logs = await window.api.servicesLogs(server.id, serviceName);
      setSelectedServiceLogs({ name: serviceName, content: logs });
    } catch (err: any) {
      console.error(`Failed to fetch logs for ${serviceName}`, err);
      setActionError(`Failed to get logs for ${serviceName}: ${err.message}`);
      setTimeout(() => setActionError(null), 5000);
    } finally {
      setLogsLoading(false);
    }
  };

  const filteredServices = useMemo(() => {
    return services.filter(s => {
      const matchSearch = s.name.toLowerCase().includes(servicesSearch.toLowerCase()) ||
        s.description.toLowerCase().includes(servicesSearch.toLowerCase());
      const matchStatus = statusFilter === 'all' || s.status === statusFilter;
      const matchEnabled = enabledFilter === 'all' || 
        (enabledFilter === 'enabled' && s.enabled) || 
        (enabledFilter === 'disabled' && !s.enabled);
      return matchSearch && matchStatus && matchEnabled;
    });
  }, [services, servicesSearch, statusFilter, enabledFilter]);

  const statusCounts = useMemo(() => {
    const counts = { running: 0, stopped: 0, failed: 0, inactive: 0, other: 0 };
    services.forEach(s => {
      if (s.status in counts) {
        counts[s.status as keyof typeof counts]++;
      } else {
        counts.other++;
      }
    });
    return counts;
  }, [services]);

  const toggleAutoRefresh = async () => {
    const newVal = !server.auto_refresh_services;
    try {
      await window.api.serverUpdate(server.id, {
        ...formData,
        auto_refresh_services: newVal
      });
      await fetchServers();
    } catch (err) {
      console.error('Failed to toggle auto refresh', err);
    }
  };

  const handleDelete = async () => {
    try {
      await window.api.serverDelete(server.id);
      await fetchServers();
      setShowDeleteModal(false);
      setDeleteConfirmValue('');
      switchServerContext(0); 
    } catch (err) {
      console.error('Failed to delete server', err);
    }
  };

  const loadContainers = async (silent = false) => {
    if (!silent) setContainersLoading(true);
    setContainersError('');
    try {
      const data = await window.api.dockerList(server.id);
      setContainers(data);
    } catch (err: any) {
      console.error('Failed to load containers', err);
      if (!silent) setContainersError(err.message || 'Failed to fetch docker containers');
    } finally {
      if (!silent) setContainersLoading(false);
    }
  };

  const handleDockerAction = async (containerId: string, action: 'start' | 'stop' | 'restart' | 'rm -f') => {
    setContainerActionLoading(`${containerId}-${action}`);
    setContainerActionError(null);
    try {
      await window.api.dockerControl(server.id, containerId, action);
      await loadContainers(true);
      if (selectedContainerLogs?.name === containerId && action !== 'rm -f') {
        handleViewDockerLogs(containerId);
      } else if (action === 'rm -f' && selectedContainerLogs?.name === containerId) {
        setSelectedContainerLogs(null);
      }
    } catch (err: any) {
      console.error(`Failed to ${action} ${containerId}`, err);
      setContainerActionError(`Failed to ${action} ${containerId}: ${err.message}`);
      setTimeout(() => setContainerActionError(null), 5000);
    } finally {
      setContainerActionLoading(null);
      if (action === 'rm -f') setDeleteContainerConfirm(null);
    }
  };

  const handleViewDockerLogs = async (containerId: string) => {
    setLogsLoading(true);
    try {
      const logs = await window.api.dockerLogs(server.id, containerId);
      setSelectedContainerLogs({ name: containerId, content: logs });
    } catch (err: any) {
      console.error(`Failed to fetch logs for ${containerId}`, err);
      setContainerActionError(`Failed to get logs for ${containerId}: ${err.message}`);
      setTimeout(() => setContainerActionError(null), 5000);
    } finally {
      setLogsLoading(false);
    }
  };

  const filteredContainers = useMemo(() => {
    return containers.filter(c => {
      const matchSearch = c.name.toLowerCase().includes(containersSearch.toLowerCase()) ||
        c.image.toLowerCase().includes(containersSearch.toLowerCase());
      const matchStatus = dockerStatusFilter === 'all' || 
        (dockerStatusFilter === 'running' && c.state === 'running') ||
        (dockerStatusFilter === 'exited' && (c.state === 'exited' || c.state === 'dead'));
      return matchSearch && matchStatus;
    });
  }, [containers, containersSearch, dockerStatusFilter]);

  const dockerStatusCounts = useMemo(() => {
    const counts = { running: 0, exited: 0 };
    containers.forEach(c => {
      if (c.state === 'running') counts.running++;
      else if (c.state === 'exited' || c.state === 'dead') counts.exited++;
    });
    return counts;
  }, [containers]);

  const tabs: { id: SettingsTab; label: string; icon: any }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'services', label: 'Services', icon: Server },
    { id: 'docker', label: 'Docker', icon: Box },
    { id: 'firewall', label: 'Firewall', icon: Shield },
    { id: 'manage', label: 'Manage', icon: Settings },
  ];

  return (
    <div className={`terminal-container settings-view ${isActive && !isHidden ? 'active' : ''}`}>
      <div className="settings-layout">
        <div className="settings-sidebar">
          <div className="settings-sidebar-header">
             <h3>Server Configuration</h3>
             <p>{server.username}@{server.host}</p>
          </div>
          <div className="settings-nav">
            {tabs.map(tab => (
              <button 
                key={tab.id}
                className={`settings-nav-item ${activeTab === tab.id ? 'active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
              >
                <tab.icon size={16} />
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="settings-content">
          {activeTab === 'dashboard' && (
            <div className="settings-section">
              <h2>Dashboard</h2>
              
              {sysInfoLoading && !sysInfo ? (
                <div className="placeholder-card">
                  <Activity size={48} className="spin-slow" />
                  <p>Connecting in background and fetching metrics for <strong>{server.name}</strong>...</p>
                </div>
              ) : sysInfoError ? (
                <div className="placeholder-card" style={{ borderColor: 'var(--danger-color)' }}>
                  <AlertCircle size={48} color="var(--danger-color)" />
                  <p>Failed to connect: {sysInfoError}</p>
                  <button className="btn btn-secondary" onClick={loadSysInfo} style={{ marginTop: '1rem' }}>Retry</button>
                </div>
              ) : sysInfo ? (
                <div className="sysinfo-grid">
                  <div className="sysinfo-card">
                    <div className="sysinfo-header">
                      <Settings size={20} color="var(--accent-color)" />
                      <h3>Operating System</h3>
                    </div>
                    <div className="sysinfo-value">{sysInfo.os}</div>
                  </div>
                  <div className="sysinfo-card">
                    <div className="sysinfo-header">
                      <Clock size={20} color="var(--success-color)" />
                      <h3>Uptime</h3>
                    </div>
                    <div className="sysinfo-value">{sysInfo.uptime}</div>
                  </div>
                  <div className="sysinfo-card">
                    <div className="sysinfo-header">
                      <Cpu size={20} color="#d2a8ff" />
                      <h3>CPU</h3>
                    </div>
                    <div className="sysinfo-value">{sysInfo.cpu || 'Unknown'}</div>
                  </div>
                  <div className="sysinfo-card">
                    <div className="sysinfo-header">
                      <Activity size={20} color="#ff7b72" />
                      <h3>Memory</h3>
                    </div>
                    <div className="sysinfo-value">{sysInfo.memory || 'Unknown'}</div>
                  </div>
                  <div className="sysinfo-card">
                    <div className="sysinfo-header">
                      <HardDrive size={20} color="#a5d6ff" />
                      <h3>Disk Space (/)</h3>
                    </div>
                    <div className="sysinfo-value">{sysInfo.disk || 'Unknown'}</div>
                  </div>
                  <div className="sysinfo-card">
                    <div className="sysinfo-header">
                      <Globe size={20} color="#7ee787" />
                      <h3>Local IP</h3>
                    </div>
                    <div className="sysinfo-value">{sysInfo.ip || 'Unknown'}</div>
                  </div>
                  <div className="sysinfo-card">
                    <div className="sysinfo-header">
                      <BarChart3 size={20} color="#f2cc60" />
                      <h3>Load Average</h3>
                    </div>
                    <div className="sysinfo-value">{sysInfo.load || 'Unknown'}</div>
                  </div>
                  <div className="sysinfo-card">
                    <div className="sysinfo-header">
                      <Users size={20} color="#d2a8ff" />
                      <h3>Active Users</h3>
                    </div>
                    <div className="sysinfo-value">{sysInfo.users || '0'}</div>
                  </div>
                  <div className="sysinfo-card">
                    <div className="sysinfo-header">
                      <Thermometer size={20} color="#ff7b72" />
                      <h3>CPU Temp</h3>
                    </div>
                    <div className="sysinfo-value">{sysInfo.temp || 'N/A'}</div>
                  </div>
                </div>
              ) : (
                <div className="placeholder-card">
                  <LayoutDashboard size={48} />
                  <p>System metrics and health overview for <strong>{server.name}</strong>.</p>
                  <button className="btn btn-primary" onClick={loadSysInfo} style={{ marginTop: '1rem' }}>Connect & Fetch Stats</button>
                </div>
              )}
            </div>
          )}

          {activeTab === 'services' && (
            <div className="settings-section services-tab">
              <div className="services-top-bar">
                <div className="services-top-bar-left">
                  <h2>System Services</h2>
                  <span className="services-subtitle">systemd units on <strong>{server.name}</strong></span>
                </div>
                <div className="services-top-bar-right">
                  <div className="auto-refresh-control">
                    <Clock size={14} />
                    <span>Auto Refresh</span>
                    <label className="switch">
                      <input 
                        type="checkbox" 
                        checked={server.auto_refresh_services} 
                        onChange={toggleAutoRefresh}
                      />
                      <span className="slider round"></span>
                    </label>
                  </div>
                  <button className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px' }} onClick={() => loadServices(true)} title="Refresh List">
                    <RefreshCcw size={14} className={servicesLoading ? 'spin' : ''} />
                    <span style={{ fontSize: '0.85rem' }}>Refresh List</span>
                  </button>
                </div>
              </div>

              {/* Summary counters */}
              {services.length > 0 && (
                <div className="services-summary">
                  <button 
                    className={`summary-chip ${statusFilter === 'all' ? 'active' : ''}`}
                    onClick={() => setStatusFilter('all')}
                  >
                    <span className="chip-count">{services.length}</span>
                    <span>Total</span>
                  </button>
                  <button 
                    className={`summary-chip running ${statusFilter === 'running' ? 'active' : ''}`}
                    onClick={() => setStatusFilter(statusFilter === 'running' ? 'all' : 'running')}
                  >
                    <span className="chip-dot running"></span>
                    <span className="chip-count">{statusCounts.running}</span>
                    <span>Running</span>
                  </button>
                  <button 
                    className={`summary-chip stopped ${statusFilter === 'stopped' || statusFilter === 'inactive' ? 'active' : ''}`}
                    onClick={() => setStatusFilter(statusFilter === 'stopped' ? 'all' : 'stopped')}
                  >
                    <span className="chip-dot stopped"></span>
                    <span className="chip-count">{statusCounts.stopped + statusCounts.inactive}</span>
                    <span>Stopped</span>
                  </button>
                  {statusCounts.failed > 0 && (
                    <button 
                      className={`summary-chip failed ${statusFilter === 'failed' ? 'active' : ''}`}
                      onClick={() => setStatusFilter(statusFilter === 'failed' ? 'all' : 'failed')}
                    >
                      <span className="chip-dot failed"></span>
                      <span className="chip-count">{statusCounts.failed}</span>
                      <span>Failed</span>
                    </button>
                  )}
                </div>
              )}

              {/* Toolbar with search and filters */}
              <div className="services-toolbar">
                <div className="search-box">
                  <Search size={16} />
                  <input 
                    placeholder="Search services..." 
                    value={servicesSearch}
                    onChange={e => setServicesSearch(e.target.value)}
                  />
                  {servicesSearch && (
                    <button className="search-clear" onClick={() => setServicesSearch('')}>
                      <X size={14} />
                    </button>
                  )}
                </div>
                <div className="services-filters">
                  <div className="filter-select">
                    <Filter size={14} />
                    <select 
                      value={enabledFilter} 
                      onChange={e => setEnabledFilter(e.target.value)}
                    >
                      <option value="all">All Units</option>
                      <option value="enabled">Enabled</option>
                      <option value="disabled">Disabled</option>
                    </select>
                    <ChevronDown size={14} className="filter-chevron" />
                  </div>
                </div>
              </div>

              {/* Error toast */}
              {actionError && (
                <div className="services-error-toast">
                  <AlertCircle size={14} />
                  <span>{actionError}</span>
                  <button onClick={() => setActionError(null)}><X size={14} /></button>
                </div>
              )}

              {servicesLoading && services.length === 0 ? (
                <div className="placeholder-card">
                  <Activity size={48} className="spin-slow" />
                  <p>Fetching systemd services...</p>
                </div>
              ) : servicesError ? (
                <div className="placeholder-card error">
                  <AlertCircle size={48} color="var(--danger-color)" />
                  <p>{servicesError}</p>
                  <button className="btn btn-secondary" onClick={() => loadServices()}>Retry</button>
                </div>
              ) : (
                <div className="services-container">
                  <div className="services-table-wrapper">
                    <table className="services-table">
                      <thead>
                        <tr>
                          <th>Unit Name</th>
                          <th>Status</th>
                          <th>Enabled</th>
                          <th>Description</th>
                          <th className="actions-cell">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredServices.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="services-empty-row">
                              No services match your filters.
                            </td>
                          </tr>
                        ) : filteredServices.map(s => (
                          <tr key={s.name} className={selectedServiceLogs?.name === s.name ? 'selected' : ''}>
                            <td className="service-name-cell">{s.name}</td>
                            <td>
                              <span className={`status-badge ${s.status}`}>
                                {s.status}
                              </span>
                            </td>
                            <td>
                              <span className={`enabled-badge ${s.enabled ? 'yes' : 'no'}`}>
                                {s.enabled ? 'Enabled' : 'Disabled'}
                              </span>
                            </td>
                            <td className="service-desc-cell" title={s.description}>{s.description}</td>
                            <td className="actions-cell">
                              <div className="service-actions-inline">
                                {s.status === 'running' ? (
                                  <button 
                                    className="action-btn stop" 
                                    title="Stop Service"
                                    onClick={() => handleServiceAction(s.name, 'stop')}
                                    disabled={actionLoading === `${s.name}-stop`}
                                  >
                                    <Square size={14} />
                                  </button>
                                ) : (
                                  <button 
                                    className="action-btn start" 
                                    title="Start Service"
                                    onClick={() => handleServiceAction(s.name, 'start')}
                                    disabled={actionLoading === `${s.name}-start`}
                                  >
                                    <Play size={14} />
                                  </button>
                                )}
                                <button 
                                  className="action-btn restart" 
                                  title="Restart Service"
                                  onClick={() => handleServiceAction(s.name, 'restart')}
                                  disabled={actionLoading === `${s.name}-restart`}
                                >
                                  <RotateCw size={14} className={actionLoading === `${s.name}-restart` ? 'spin' : ''} />
                                </button>
                                <button 
                                  className={`action-btn logs ${selectedServiceLogs?.name === s.name ? 'active' : ''}`} 
                                  title="View Journal Logs"
                                  onClick={() => handleViewLogs(s.name)}
                                >
                                  <FileSearch size={14} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {selectedServiceLogs && (
                    <div className="logs-drawer">
                      <div className="logs-header">
                        <div className="logs-header-title">
                          <FileSearch size={16} />
                          <span>Journal: <strong>{selectedServiceLogs.name}</strong></span>
                        </div>
                        <div className="logs-actions">
                          <button 
                            className="action-btn" 
                            onClick={() => handleViewLogs(selectedServiceLogs.name)} 
                            title="Refresh Logs"
                            disabled={logsLoading}
                          >
                            <RefreshCcw size={14} className={logsLoading ? 'spin' : ''} />
                          </button>
                          <button className="action-btn" onClick={() => setSelectedServiceLogs(null)} title="Close Logs">
                            <X size={14} />
                          </button>
                        </div>
                      </div>
                      <div className="logs-content">
                        {logsLoading ? (
                          <div className="logs-loading">
                            <Activity size={32} className="spin" color="var(--accent-color)" />
                            <p>Tailing journalctl logs...</p>
                          </div>
                        ) : (
                          <pre>{selectedServiceLogs.content || 'No log entries found for this unit.'}</pre>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Footer status bar */}
              {services.length > 0 && (
                <div className="services-status-bar">
                  <span>{filteredServices.length} of {services.length} services shown</span>
                  {(statusFilter !== 'all' || enabledFilter !== 'all' || servicesSearch) && (
                    <button className="clear-filters-btn" onClick={() => {
                      setStatusFilter('all');
                      setEnabledFilter('all');
                      setServicesSearch('');
                    }}>
                      Clear all filters
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {activeTab === 'docker' && (
            <div className="settings-section services-tab">
              <div className="services-top-bar">
                <div className="services-top-bar-left">
                  <h2>Docker Containers</h2>
                  <span className="services-subtitle">running on <strong>{server.name}</strong></span>
                </div>
                <div className="services-top-bar-right">
                  <button className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px' }} onClick={() => loadContainers(true)} title="Refresh List">
                    <RefreshCcw size={14} className={containersLoading ? 'spin' : ''} />
                    <span style={{ fontSize: '0.85rem' }}>Refresh List</span>
                  </button>
                </div>
              </div>

              {/* Summary counters */}
              {containers.length > 0 && (
                <div className="services-summary">
                  <button 
                    className={`summary-chip ${dockerStatusFilter === 'all' ? 'active' : ''}`}
                    onClick={() => setDockerStatusFilter('all')}
                  >
                    <span className="chip-count">{containers.length}</span>
                    <span>Total</span>
                  </button>
                  <button 
                    className={`summary-chip running ${dockerStatusFilter === 'running' ? 'active' : ''}`}
                    onClick={() => setDockerStatusFilter(dockerStatusFilter === 'running' ? 'all' : 'running')}
                  >
                    <span className="chip-dot running"></span>
                    <span className="chip-count">{dockerStatusCounts.running}</span>
                    <span>Running</span>
                  </button>
                  <button 
                    className={`summary-chip stopped ${dockerStatusFilter === 'exited' ? 'active' : ''}`}
                    onClick={() => setDockerStatusFilter(dockerStatusFilter === 'exited' ? 'all' : 'exited')}
                  >
                    <span className="chip-dot stopped"></span>
                    <span className="chip-count">{dockerStatusCounts.exited}</span>
                    <span>Exited</span>
                  </button>
                </div>
              )}

              {/* Toolbar with search */}
              <div className="services-toolbar">
                <div className="search-box">
                  <Search size={16} />
                  <input 
                    placeholder="Search containers..." 
                    value={containersSearch}
                    onChange={e => setContainersSearch(e.target.value)}
                  />
                  {containersSearch && (
                    <button className="search-clear" onClick={() => setContainersSearch('')}>
                      <X size={14} />
                    </button>
                  )}
                </div>
              </div>

              {/* Error toast */}
              {containerActionError && (
                <div className="services-error-toast">
                  <AlertCircle size={14} />
                  <span>{containerActionError}</span>
                  <button onClick={() => setContainerActionError(null)}><X size={14} /></button>
                </div>
              )}

              {containersLoading && containers.length === 0 ? (
                <div className="placeholder-card">
                  <Activity size={48} className="spin-slow" />
                  <p>Fetching docker containers...</p>
                </div>
              ) : containersError ? (
                <div className="placeholder-card error">
                  <AlertCircle size={48} color="var(--danger-color)" />
                  <p>{containersError}</p>
                  <button className="btn btn-secondary" onClick={() => loadContainers()}>Retry</button>
                </div>
              ) : (
                <div className="services-container">
                  <div className="services-table-wrapper">
                    <table className="services-table">
                      <thead>
                        <tr>
                          <th>Name</th>
                          <th>Status</th>
                          <th>Image</th>
                          <th>Ports</th>
                          <th className="actions-cell">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredContainers.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="services-empty-row">
                              No containers match your search.
                            </td>
                          </tr>
                        ) : filteredContainers.map(c => (
                          <tr key={c.id} className={selectedContainerLogs?.name === c.id ? 'selected' : ''}>
                            <td className="service-name-cell">{c.name}</td>
                            <td>
                              <span className={`status-badge ${c.state === 'running' ? 'running' : 'stopped'}`}>
                                {c.status}
                              </span>
                            </td>
                            <td>{c.image}</td>
                            <td className="service-desc-cell" title={c.ports}>{c.ports || '-'}</td>
                            <td className="actions-cell">
                              <div className="service-actions-inline">
                                {c.state === 'running' ? (
                                  <button 
                                    className="action-btn stop" 
                                    title="Stop Container"
                                    onClick={() => handleDockerAction(c.id, 'stop')}
                                    disabled={containerActionLoading === `${c.id}-stop`}
                                  >
                                    <Square size={14} />
                                  </button>
                                ) : (
                                  <button 
                                    className="action-btn start" 
                                    title="Start Container"
                                    onClick={() => handleDockerAction(c.id, 'start')}
                                    disabled={containerActionLoading === `${c.id}-start`}
                                  >
                                    <Play size={14} />
                                  </button>
                                )}
                                <button 
                                  className="action-btn restart" 
                                  title="Restart Container"
                                  onClick={() => handleDockerAction(c.id, 'restart')}
                                  disabled={containerActionLoading === `${c.id}-restart`}
                                >
                                  <RotateCw size={14} className={containerActionLoading === `${c.id}-restart` ? 'spin' : ''} />
                                </button>
                                <button 
                                  className={`action-btn logs ${selectedContainerLogs?.name === c.id ? 'active' : ''}`} 
                                  title="View Logs"
                                  onClick={() => handleViewDockerLogs(c.id)}
                                >
                                  <FileSearch size={14} />
                                </button>
                                {deleteContainerConfirm === c.id ? (
                                  <div className="action-confirm-group">
                                    <button 
                                      className="action-btn restart" 
                                      title="Cancel"
                                      onClick={() => setDeleteContainerConfirm(null)}
                                    >
                                      <X size={14} />
                                    </button>
                                    <button 
                                      className="action-btn"
                                      style={{ color: 'var(--danger-color)', border: '1px solid var(--danger-color)', background: 'rgba(248, 81, 73, 0.1)' }}
                                      title="Confirm Delete"
                                      onClick={() => handleDockerAction(c.id, 'rm -f')}
                                      disabled={containerActionLoading === `${c.id}-rm -f`}
                                    >
                                      <Trash2 size={14} className={containerActionLoading === `${c.id}-rm -f` ? 'spin' : ''} />
                                    </button>
                                  </div>
                                ) : (
                                  <button 
                                    className="action-btn stop" 
                                    title="Force Remove"
                                    onClick={() => setDeleteContainerConfirm(c.id)}
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {selectedContainerLogs && (
                    <div className="logs-drawer">
                      <div className="logs-header">
                        <div className="logs-header-title">
                          <FileSearch size={16} />
                          <span>Container Logs: <strong>{selectedContainerLogs.name}</strong></span>
                        </div>
                        <div className="logs-actions">
                          <button 
                            className="action-btn" 
                            onClick={() => handleViewDockerLogs(selectedContainerLogs.name)} 
                            title="Refresh Logs"
                            disabled={logsLoading}
                          >
                            <RefreshCcw size={14} className={logsLoading ? 'spin' : ''} />
                          </button>
                          <button className="action-btn" onClick={() => setSelectedContainerLogs(null)} title="Close Logs">
                            <X size={14} />
                          </button>
                        </div>
                      </div>
                      <div className="logs-content">
                        {logsLoading ? (
                          <div className="logs-loading">
                            <Activity size={32} className="spin" color="var(--accent-color)" />
                            <p>Tailing docker logs...</p>
                          </div>
                        ) : (
                          <pre>{selectedContainerLogs.content || 'No log entries found for this container.'}</pre>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Footer status bar */}
              {containers.length > 0 && (
                <div className="services-status-bar">
                  <span>{filteredContainers.length} of {containers.length} containers shown</span>
                  {(dockerStatusFilter !== 'all' || containersSearch) && (
                    <button className="clear-filters-btn" onClick={() => {
                      setDockerStatusFilter('all');
                      setContainersSearch('');
                    }}>
                      Clear all filters
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {activeTab === 'firewall' && (
            <div className="settings-section">
              <h2>Firewall</h2>
              <div className="placeholder-card">
                <Shield size={48} />
                <p>Configure UFW or Iptables rules for <strong>{server.name}</strong>.</p>
                <span className="badge">Coming Soon</span>
              </div>
            </div>
          )}

          {activeTab === 'manage' && (
            <div className="settings-section">
              <div className="settings-header">
                <h2>Manage Server</h2>
                <p>Update connection details or permanently remove this server.</p>
              </div>

              <div className="manage-grid">
                <div className="card edit-card">
                  <h3>Connection Settings</h3>
                  <form onSubmit={async (e) => {
                    e.preventDefault();
                    try {
                      await window.api.serverUpdate(server.id, formData);
                      await fetchServers();
                      setSaveMessage('Settings saved successfully!');
                      setTimeout(() => setSaveMessage(''), 3000);
                    } catch (err) {
                      console.error(err);
                      setSaveMessage('Failed to save settings.');
                    }
                  }}>
                    <div className="form-grid">
                      <div className="form-group">
                        <label>Display Name</label>
                        <input 
                          value={formData.name} 
                          onChange={e => setFormData({...formData, name: e.target.value})} 
                          placeholder="e.g. Home Server"
                        />
                      </div>
                      <div className="form-group">
                        <label>Icon</label>
                        <div className="icon-selector-inline">
                          {AVAILABLE_ICONS.slice(0, 10).map(icon => {
                            const IconComp = (LucideIcons as any)[icon] || LucideIcons.Server;
                            return (
                              <button
                                key={icon}
                                type="button"
                                className={`icon-btn-small ${formData.icon === icon ? 'active' : ''}`}
                                onClick={() => setFormData({...formData, icon})}
                                title={icon}
                              >
                                <IconComp size={16} />
                              </button>
                            );
                          })}
                        </div>
                      </div>
                      <div className="form-group">
                        <label className="checkbox-label">
                           <input 
                             type="checkbox" 
                             checked={formData.auto_refresh_services} 
                             onChange={e => setFormData({...formData, auto_refresh_services: e.target.checked})} 
                           />
                           <span>Auto refresh services list (30s)</span>
                        </label>
                      </div>
                    </div>

                    <div className="form-row">
                      <div className="form-group flex-2">
                        <label>Host / IP</label>
                        <input 
                          value={formData.host} 
                          onChange={e => setFormData({...formData, host: e.target.value})} 
                        />
                      </div>
                      <div className="form-group flex-1">
                        <label>Port</label>
                        <input 
                          type="number"
                          value={formData.port} 
                          onChange={e => setFormData({...formData, port: parseInt(e.target.value)})} 
                        />
                      </div>
                    </div>

                    <div className="form-group">
                      <label>Username</label>
                      <input 
                        value={formData.username} 
                        onChange={e => setFormData({...formData, username: e.target.value})} 
                      />
                    </div>

                    <div className="form-group">
                      <label>Authentication Method</label>
                      <select 
                        value={formData.auth_type} 
                        onChange={e => setFormData({...formData, auth_type: e.target.value as any})}
                      >
                        <option value="password">Password</option>
                        <option value="key">SSH Key</option>
                      </select>
                    </div>

                    {formData.auth_type === 'password' ? (
                      <div className="form-group">
                        <label>Password</label>
                        <input 
                          type="password" 
                          value={formData.password} 
                          onChange={e => setFormData({...formData, password: e.target.value})} 
                        />
                      </div>
                    ) : (
                      <div className="form-group">
                        <label>Private Key</label>
                        <div className="key-path-display">
                          <code title={formData.private_key_path}>{formData.private_key_path || 'No key selected'}</code>
                          <button type="button" className="btn-small" onClick={async () => {
                            const path = await window.api.dialogOpenFile();
                            if (path) setFormData({...formData, private_key_path: path});
                          }}>Browse</button>
                        </div>
                      </div>
                    )}

                    <div className="form-actions">
                      {saveMessage && <span className={`save-status ${saveMessage.includes('Failed') ? 'error' : 'success'}`}>{saveMessage}</span>}
                      <button type="submit" className="btn btn-primary">Save Changes</button>
                    </div>
                  </form>
                </div>

                <div className="card danger-zone">
                  <div className="danger-header">
                    <AlertCircle size={20} />
                    <h3>Danger Zone</h3>
                  </div>
                  <p>Permanently remove this server and all its session history from Homelab Manager.</p>
                  <button className="btn btn-danger-outline" onClick={() => setShowDeleteModal(true)}>
                    Delete Server
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {showDeleteModal && (
        <div className="modal-overlay">
          <div className="modal delete-modal">
            <div className="modal-header">
              <AlertCircle color="var(--danger-color)" size={32} />
              <h2>Delete {server.name}?</h2>
            </div>
            <p>This will permanently remove the configuration for <strong>{server.name}</strong>.</p>
            <p className="confirm-text">Please type <strong>{server.name}</strong> to confirm:</p>
            <input 
              type="text" 
              className="confirm-input"
              value={deleteConfirmValue}
              onChange={e => setDeleteConfirmValue(e.target.value)}
              placeholder={server.name}
              autoFocus
            />
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => { setShowDeleteModal(false); setDeleteConfirmValue(''); }}>Cancel</button>
              <button 
                className="btn btn-danger" 
                disabled={deleteConfirmValue !== server.name}
                onClick={handleDelete}
              >
                Permanently Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ServerSettings;

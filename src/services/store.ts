import { 
  UserProfile, 
  Organization,
  FoodListing, 
  RescueMission, 
  DonationRequest, 
  CommunityHotspot, 
  CommunityHub, 
  VolunteerProfile, 
  SafetyIncident, 
  BeneficiaryRecord, 
  DistributionRecord,
  DonorBusinessProfile,
  AcceptorProfile,
  NGOProfile,
  RescueMateProfile,
  ChatConversation,
  ChatMessage,
  WhatsAppIntegrationConfig,
  NotificationPreferences,
  UserRole,
  EventRegistration,
  EventSurplusPrediction,
  EventInterestRegistration,
  HostelProfile,
  HostelDailyMealPlan,
  LiveSyncEvent,
  LiveSyncEventType,
  ClaimMissionResult,
  AppNotification
} from '../types';

import { 
  INITIAL_PROFILES, 
  INITIAL_ORGANIZATIONS,
  INITIAL_FOOD_LISTINGS, 
  INITIAL_RESCUE_MISSIONS, 
  INITIAL_DONATION_REQUESTS, 
  INITIAL_COMMUNITY_HOTSPOTS, 
  INITIAL_COMMUNITY_HUBS, 
  INITIAL_VOLUNTEERS, 
  INITIAL_SAFETY_INCIDENTS, 
  INITIAL_BENEFICIARIES, 
  INITIAL_DISTRIBUTIONS,
  INITIAL_DONOR_PROFILES,
  INITIAL_ACCEPTOR_PROFILES,
  INITIAL_NGO_PROFILES,
  INITIAL_RESCUEMATES,
  INITIAL_CONVERSATIONS,
  INITIAL_CHAT_MESSAGES,
  INITIAL_WHATSAPP_CONFIG,
  INITIAL_NOTIFICATION_PREFERENCES,
  INITIAL_EVENT_REGISTRATIONS,
  INITIAL_EVENT_INTERESTS,
  INITIAL_HOSTEL_PROFILES,
  INITIAL_HOSTEL_MEAL_PLANS
} from './mockData';

type Listener = () => void;

class UnavuLinkStore {
  private listeners: Set<Listener> = new Set();
  private clientId: string = `client-${Math.random().toString(36).substring(2, 9)}`;
  private syncChannel: BroadcastChannel | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      try {
        if ('BroadcastChannel' in window) {
          this.syncChannel = new BroadcastChannel('unavulink_livesync');
          this.syncChannel.onmessage = (ev) => {
            if (ev.data && ev.data.originClientId !== this.clientId) {
              this.emitChange();
            }
          };
        }
      } catch (err) {
        console.warn('LiveSync BroadcastChannel not initialized', err);
      }

      window.addEventListener('storage', (e) => {
        if (e.key && e.key.startsWith('unavulink_')) {
          this.emitChange();
        }
      });
    }
  }

  private emitChange(): void {
    this.listeners.forEach(listener => {
      try {
        listener();
      } catch (err) {
        console.error('Store listener error:', err);
      }
    });
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private getStorage<T>(key: string, defaultVal: T): T {
    try {
      const item = localStorage.getItem(`unavulink_${key}`);
      return item ? JSON.parse(item) : defaultVal;
    } catch {
      return defaultVal;
    }
  }

  private setStorage<T>(key: string, val: T): void {
    try {
      localStorage.setItem(`unavulink_${key}`, JSON.stringify(val));
      this.emitChange();
    } catch (e) {
      console.warn('Storage save failed:', e);
    }
  }

  // --- ENVIRONMENT MODE (REAL SUPABASE VS VIRTUAL WORLD DEMO) ---
  getEnvironmentMode(): 'real' | 'virtual_world' {
    return this.getStorage('env_mode', 'virtual_world');
  }

  setEnvironmentMode(mode: 'real' | 'virtual_world'): void {
    this.setStorage('env_mode', mode);
  }

  // --- CURRENT LOCATION CONTEXT ---
  getSelectedCity(): string {
    return this.getStorage('selected_city', 'Coimbatore');
  }

  setSelectedCity(city: string): void {
    this.setStorage('selected_city', city);
  }

  // --- PROFILES ---
  getProfiles(): UserProfile[] {
    return this.getStorage('profiles', INITIAL_PROFILES);
  }

  getProfileById(id: string): UserProfile | undefined {
    return this.getProfiles().find(p => p.id === id);
  }

  updateProfile(profile: UserProfile): void {
    const list = this.getProfiles().map(p => p.id === profile.id ? profile : p);
    this.setStorage('profiles', list);
  }

  // --- ORGANIZATIONS ---
  getOrganizations(): Organization[] {
    return this.getStorage('organizations', INITIAL_ORGANIZATIONS);
  }

  getOrganizationById(id: string): Organization | undefined {
    return this.getOrganizations().find(o => o.id === id);
  }

  // --- FOOD LISTINGS ---
  getListings(): FoodListing[] {
    return this.getStorage('listings', INITIAL_FOOD_LISTINGS);
  }

  getListingById(id: string): FoodListing | undefined {
    return this.getListings().find(l => l.id === id);
  }

  getListingByBatchId(batchId: string): FoodListing | undefined {
    return this.getListings().find(l => l.batch_id === batchId);
  }

  addListing(listing: FoodListing): void {
    const list = [listing, ...this.getListings()];
    this.setStorage('listings', list);

    // LiveSync Intimation across all clients/tabs immediately
    this.broadcastLiveSync(
      'SURPLUS_CONFIRMED',
      listing,
      `New food surplus posted by ${listing.donor_name || 'Donor Kitchen'}: ${listing.food_name} (${listing.estimated_portions} portions / ${listing.quantity} ${listing.unit}) in ${listing.pickup_location}`
    );

    // Intimate Acceptors & NGOs with in-app real-time notification
    const newNotif: AppNotification = {
      id: `notif-${Date.now()}`,
      user_id: 'acceptor-all',
      title: '🚨 New Food Surplus Alert!',
      message: `${listing.donor_name || 'Donor'} posted ${listing.food_name} (${listing.estimated_portions} portions) at ${listing.pickup_location}. Ready for intake request.`,
      type: listing.is_emergency ? 'urgent' : 'success',
      link: '/acceptor',
      is_read: false,
      created_at: new Date().toISOString()
    };
    const notifications = this.getStorage<AppNotification[]>('notifications', []);
    this.setStorage('notifications', [newNotif, ...notifications].slice(0, 50));
  }

  getNotifications(userId?: string): AppNotification[] {
    const all = this.getStorage<AppNotification[]>('notifications', [
      {
        id: 'notif-seed-1',
        user_id: 'acceptor-all',
        title: '🔔 Verified Surplus Intimation',
        message: 'Annapoorna Caterers posted Traditional Sambar Rice (140 portions) at R.S. Puram. Ready for intake.',
        type: 'success',
        link: '/acceptor',
        is_read: false,
        created_at: new Date(Date.now() - 3600000).toISOString()
      }
    ]);
    return userId ? all.filter(n => n.user_id === userId || n.user_id === 'acceptor-all') : all;
  }

  markNotificationAsRead(id: string): void {
    const all = this.getNotifications().map(n => n.id === id ? { ...n, is_read: true } : n);
    this.setStorage('notifications', all);
  }

  // --- WHATSAPP CLOUD API & DIRECT SURPLUS DISPATCH ---
  sendWhatsAppSurplusAlert(
    phone: string, 
    listing?: FoodListing | null, 
    customMsg?: string
  ): { success: boolean; message: string; waUrl: string; messageId: string } {
    let cleanPhone = phone.replace(/[^\d+]/g, '');
    if (!cleanPhone.startsWith('+')) {
      if (cleanPhone.length === 10) {
        cleanPhone = '+91' + cleanPhone;
      } else {
        cleanPhone = '+' + cleanPhone;
      }
    }

    const foodTitle = listing?.food_name || 'Fresh Meal Surplus';
    const portions = listing?.estimated_portions || 60;
    const location = listing?.pickup_location || 'Coimbatore Kitchen';
    const batchId = listing?.batch_id || 'UNV-SURPLUS';

    const text = customMsg || `📢 UnavuLink Surplus Alert: here the food is surplus! Fresh hot meal batch available for immediate collection. Batch: ${batchId}, Quantity: ${portions} meals. Location: ${location}. Claim now on UnavuLink: https://rishikapilesh-gif.github.io/UnavuLink`;

    const cleanDigits = cleanPhone.replace('+', '');
    const waUrl = `https://api.whatsapp.com/send?phone=${cleanDigits}&text=${encodeURIComponent(text)}`;
    const messageId = `wamid.HBgM${cleanDigits.slice(-6)}${Date.now().toString().slice(-6)}`;

    // Broadcast through LiveSync so all dashboards show the dispatch
    this.broadcastLiveSync(
      'STATUS_CHANGE',
      { phone: cleanPhone, messageId, text },
      `WhatsApp Alert sent to ${cleanPhone}: "here the food is surplus" (${portions} meals)`
    );

    // Save WhatsApp dispatch history
    const logs = this.getStorage<any[]>('whatsapp_dispatch_logs', []);
    const newLog = {
      id: messageId,
      phone: cleanPhone,
      text,
      status: 'delivered',
      timestamp: new Date().toISOString()
    };
    this.setStorage('whatsapp_dispatch_logs', [newLog, ...logs].slice(0, 50));

    return {
      success: true,
      message: `WhatsApp alert dispatched to ${cleanPhone}: "${text}"`,
      waUrl,
      messageId
    };
  }

  getWhatsAppDispatchLogs(): any[] {
    return this.getStorage('whatsapp_dispatch_logs', [
      {
        id: 'wamid.HBgM9842210001001',
        phone: '+91 98422 10001',
        text: '📢 UnavuLink Surplus Alert: here the food is surplus! Fresh meals ready for pickup.',
        status: 'delivered',
        timestamp: new Date(Date.now() - 3600000 * 2).toISOString()
      }
    ]);
  }

  updateListing(listing: FoodListing): void {
    const list = this.getListings().map(l => l.id === listing.id ? listing : l);
    this.setStorage('listings', list);
  }

  freezeListing(batchId: string, reason: string): void {
    const list = this.getListings().map(l => {
      if (l.batch_id === batchId) {
        return {
          ...l,
          safety_status: 'frozen' as const,
          listing_status: 'frozen' as const,
          handling_information: `SAFETY FREEZE: ${reason}`
        };
      }
      return l;
    });
    this.setStorage('listings', list);
  }

  // --- RESCUE MISSIONS ---
  getMissions(): RescueMission[] {
    return this.getStorage('missions', INITIAL_RESCUE_MISSIONS);
  }

  getMissionById(id: string): RescueMission | undefined {
    return this.getMissions().find(m => m.id === id);
  }

  addMission(mission: RescueMission): void {
    const list = [mission, ...this.getMissions()];
    this.setStorage('missions', list);
  }

  updateMission(mission: RescueMission): void {
    const list = this.getMissions().map(m => m.id === mission.id ? mission : m);
    this.setStorage('missions', list);
  }

  // --- DONATION REQUESTS & INTERCONNECTED LIFECYCLE ---
  getRequests(): DonationRequest[] {
    return this.getStorage('requests', INITIAL_DONATION_REQUESTS);
  }

  addRequest(req: DonationRequest): void {
    const list = [req, ...this.getRequests()];
    this.setStorage('requests', list);

    // Update listing status to request_received
    const listing = this.getListingById(req.food_listing_id);
    if (listing && listing.listing_status === 'available') {
      this.updateListing({
        ...listing,
        listing_status: 'request_received'
      });
    }
  }

  updateRequest(req: DonationRequest): void {
    const list = this.getRequests().map(r => r.id === req.id ? req : r);
    this.setStorage('requests', list);
  }

  /**
   * Donor processes a donation request: accept or reject.
   * On acceptance, the request status becomes 'accepted' and a rescue mission is created.
   * On rejection, status becomes 'rejected' and listing status reverts to 'available'.
   */
  donorRespondToRequest(requestId: string, accept: boolean): { success: boolean; message: string } {
    const req = this.getRequests().find(r => r.id === requestId);
    if (!req) return { success: false, message: 'Request not found.' };

    if (accept) {
      const updatedReq: DonationRequest = { ...req, request_status: 'accepted' };
      this.updateRequest(updatedReq);
      this.approveRequestAndCreateMission(updatedReq);
      return { success: true, message: 'Request accepted and mission created.' };
    } else {
      const updatedReq: DonationRequest = { ...req, request_status: 'rejected' };
      this.updateRequest(updatedReq);
      const listing = this.getListingById(req.food_listing_id);
      if (listing && listing.listing_status !== 'available') {
        this.updateListing({ ...listing, listing_status: 'available' });
      }
      return { success: true, message: 'Request rejected.' };
    }
  }

  /**
   * Volunteer responds to an assigned mission (yes/no).
   * If accepted, mission status becomes 'volunteer_confirmed'.
   * If declined, mission status becomes 'volunteer_declined'.
   */
  volunteerRespondToMission(missionId: string, accept: boolean): { success: boolean; message: string } {
    const mission = this.getMissionById(missionId);
    if (!mission) return { success: false, message: 'Mission not found.' };

    if (accept) {
      const updatedMission: RescueMission = { ...mission, mission_status: 'volunteer_confirmed' };
      this.updateMission(updatedMission);
      this.broadcastLiveSync('VOLUNTEER_ACCEPTED', updatedMission, `Volunteer ${updatedMission.volunteer_name} accepted mission ${mission.id}`);
      return { success: true, message: 'Volunteer accepted the mission.' };
    } else {
      const updatedMission: RescueMission = { ...mission, mission_status: 'volunteer_declined' };
      this.updateMission(updatedMission);
      this.broadcastLiveSync('VOLUNTEER_DECLINED', updatedMission, `Volunteer ${updatedMission.volunteer_name} declined mission ${mission.id}`);
      return { success: true, message: 'Volunteer declined the mission.' };
    }
  }

  /**
   * Record a public tip/donation to a charity centre.
   */
  addPublicTip(donorId: string, amount: number, note?: string): { success: boolean; tipId: string } {
    const tip = {
      id: `tip-${Date.now()}`,
      donor_id: donorId,
      amount,
      note: note || '',
      created_at: new Date().toISOString()
    };
    const tips = this.getStorage<any[]>('public_tips', []);
    this.setStorage('public_tips', [tip, ...tips].slice(0, 100));
    return { success: true, tipId: tip.id };
  }

  /**
   * Retrieve public tips (optional filter by donor).
   */
  getPublicTips(donorId?: string): any[] {
    const all = this.getStorage<any[]>('public_tips', []);
    return donorId ? all.filter(t => t.donor_id === donorId) : all;
  }

  /**
   * SEAMLESS INTERCONNECTION: Approve request and automatically spawn active RescueMission
   */
  approveRequestAndCreateMission(req: DonationRequest, notes?: string): RescueMission {
    // 1. Mark request as approved
    const updatedReq: DonationRequest = {
      ...req,
      request_status: 'approved',
      approved_quantity: req.requested_quantity,
      donor_response_notes: notes || 'Approved for community shelter redistribution.'
    };
    this.updateRequest(updatedReq);

    // 2. Fetch associated listing
    const listing = this.getListingById(req.food_listing_id) || this.getListings()[0];
    
    // Update listing status
    this.updateListing({
      ...listing,
      listing_status: 'approved'
    });

    // 3. Find available volunteer
    const volunteers = this.getVolunteers();
    const assignedVol = volunteers.find(v => v.availability_status === 'available') || volunteers[0];

    // 4. Create interconnected Rescue Mission with secure 6-digit OTPs
    const pickupOtp = `${Math.floor(100000 + Math.random() * 900000)}`;
    const deliveryOtp = `${Math.floor(100000 + Math.random() * 900000)}`;

    const newMission: RescueMission = {
      id: `msn-${Date.now()}`,
      batch_id: listing.batch_id,
      food_listing_id: listing.id,
      food_name: listing.food_name,
      donor_id: listing.donor_id,
      donor_name: listing.donor_name || 'Verified Donor Kitchen',
      recipient_id: req.requester_id,
      recipient_name: req.organization_name || req.requester_name,
      volunteer_id: assignedVol.user_id,
      volunteer_name: assignedVol.full_name || 'Karthik Subramanian',
      volunteer_phone: '+91 98422 60006',
      mission_status: 'volunteer_assigned',
      pickup_otp: pickupOtp,
      delivery_otp: deliveryOtp,
      pickup_address: listing.pickup_location,
      pickup_lat: listing.latitude,
      pickup_lng: listing.longitude,
      delivery_address: 'Saibaba Colony Shelter / Ukkadam Hub',
      delivery_lat: 11.0264,
      delivery_lng: 76.9421,
      distance_km: 6.4,
      estimated_duration_mins: 20,
      created_at: new Date().toISOString()
    };

    this.addMission(newMission);
    return newMission;
  }

  /**
   * SEAMLESS INTERCONNECTION: Complete Pickup Handover with OTP validation
   */
  confirmPickupHandover(missionId: string, enteredOtp: string): { success: boolean; message: string } {
    const mission = this.getMissionById(missionId);
    if (!mission) return { success: false, message: 'Mission not found.' };

    if (enteredOtp.trim() !== mission.pickup_otp.trim()) {
      return { success: false, message: 'Incorrect Pickup OTP entered.' };
    }

    const updatedMission: RescueMission = {
      ...mission,
      mission_status: 'picked_up'
    };
    this.updateMission(updatedMission);

    // Update listing status to in_transit
    const listing = this.getListingById(mission.food_listing_id);
    if (listing) {
      this.updateListing({
        ...listing,
        listing_status: 'in_transit'
      });
    }

    return { success: true, message: 'Pickup handover successfully verified! Food is now in transit.' };
  }

  /**
   * SEAMLESS INTERCONNECTION: Complete Delivery Handover with OTP validation
   */
  confirmDeliveryHandover(missionId: string, enteredOtp: string): { success: boolean; message: string } {
    const mission = this.getMissionById(missionId);
    if (!mission) return { success: false, message: 'Mission not found.' };

    if (enteredOtp.trim() !== mission.delivery_otp.trim()) {
      return { success: false, message: 'Incorrect Delivery OTP entered.' };
    }

    const updatedMission: RescueMission = {
      ...mission,
      mission_status: 'delivered'
    };
    this.updateMission(updatedMission);

    // Update listing status to completed
    const listing = this.getListingById(mission.food_listing_id);
    if (listing) {
      this.updateListing({
        ...listing,
        listing_status: 'completed'
      });

      // Automatically add verified distribution record
      const distRecord: DistributionRecord = {
        id: `dist-${Date.now()}`,
        organization_id: 'org-ngo-1',
        batch_id: listing.batch_id,
        quantity_received_kg: listing.quantity,
        quantity_distributed_kg: listing.quantity,
        meals_served_count: listing.estimated_portions,
        remaining_quantity_kg: 0,
        distribution_location: mission.delivery_address,
        distribution_time: new Date().toISOString(),
        notes: `Verified receipt and distribution of ${listing.food_name} via delivery OTP.`
      };
      this.addDistribution(distRecord);
    }

    return { success: true, message: 'Delivery receipt verified! Meal distribution logged into impact ledger.' };
  }

  // --- COMMUNITY HOTSPOTS ---
  getHotspots(): CommunityHotspot[] {
    return this.getStorage('hotspots', INITIAL_COMMUNITY_HOTSPOTS);
  }

  addHotspot(hotspot: CommunityHotspot): void {
    const list = [hotspot, ...this.getHotspots()];
    this.setStorage('hotspots', list);
  }

  // --- COMMUNITY HUBS ---
  getHubs(): CommunityHub[] {
    return this.getStorage('hubs', INITIAL_COMMUNITY_HUBS);
  }

  // --- VOLUNTEERS ---
  getVolunteers(): VolunteerProfile[] {
    return this.getStorage('volunteers', INITIAL_VOLUNTEERS);
  }

  getVolunteerByUserId(userId: string): VolunteerProfile | undefined {
    return this.getVolunteers().find(v => v.user_id === userId);
  }

  updateVolunteer(vol: VolunteerProfile): void {
    const list = this.getVolunteers().map(v => v.id === vol.id ? vol : v);
    this.setStorage('volunteers', list);
  }

  // --- SAFETY INCIDENTS ---
  getIncidents(): SafetyIncident[] {
    return this.getStorage('incidents', INITIAL_SAFETY_INCIDENTS);
  }

  addIncident(incident: SafetyIncident): void {
    const list = [incident, ...this.getIncidents()];
    this.setStorage('incidents', list);
    // Automatically freeze affected food batch
    this.freezeListing(incident.batch_id, incident.description);
  }

  // --- BENEFICIARIES ---
  getBeneficiaries(): BeneficiaryRecord[] {
    return this.getStorage('beneficiaries', INITIAL_BENEFICIARIES);
  }

  addBeneficiary(ben: BeneficiaryRecord): void {
    const list = [ben, ...this.getBeneficiaries()];
    this.setStorage('beneficiaries', list);
  }

  // --- DISTRIBUTION RECORDS ---
  getDistributions(): DistributionRecord[] {
    return this.getStorage('distributions', INITIAL_DISTRIBUTIONS);
  }

  addDistribution(dist: DistributionRecord): void {
    const list = [dist, ...this.getDistributions()];
    this.setStorage('distributions', list);
  }

  // --- MODULE 2 & 3: ROLE-SPECIFIC PROFILES ---

  // DONOR BUSINESS PROFILES
  getDonorProfiles(): DonorBusinessProfile[] {
    return this.getStorage('donor_profiles', INITIAL_DONOR_PROFILES);
  }

  getDonorProfileByUserId(userId: string): DonorBusinessProfile | undefined {
    return this.getDonorProfiles().find(d => d.user_id === userId);
  }

  addDonorProfile(profile: DonorBusinessProfile): void {
    const list = [profile, ...this.getDonorProfiles()];
    this.setStorage('donor_profiles', list);
  }

  updateDonorProfile(profile: DonorBusinessProfile): void {
    const list = this.getDonorProfiles().map(d => d.id === profile.id ? profile : d);
    this.setStorage('donor_profiles', list);
  }

  // ACCEPTOR PROFILES
  getAcceptorProfiles(): AcceptorProfile[] {
    return this.getStorage('acceptor_profiles', INITIAL_ACCEPTOR_PROFILES);
  }

  getAcceptorProfileByUserId(userId: string): AcceptorProfile | undefined {
    return this.getAcceptorProfiles().find(a => a.user_id === userId);
  }

  addAcceptorProfile(profile: AcceptorProfile): void {
    const list = [profile, ...this.getAcceptorProfiles()];
    this.setStorage('acceptor_profiles', list);
  }

  // NGO PROFILES
  getNGOProfiles(): NGOProfile[] {
    return this.getStorage('ngo_profiles', INITIAL_NGO_PROFILES);
  }

  getNGOProfileByUserId(userId: string): NGOProfile | undefined {
    return this.getNGOProfiles().find(n => n.user_id === userId);
  }

  addNGOProfile(profile: NGOProfile): void {
    const list = [profile, ...this.getNGOProfiles()];
    this.setStorage('ngo_profiles', list);
  }

  // --- MODULE 2.5: RESCUEMATE WORKFLOW & PERMISSIONS ---
  getRescueMates(): RescueMateProfile[] {
    return this.getStorage('rescuemates', INITIAL_RESCUEMATES);
  }

  getRescueMateByUserId(userId: string): RescueMateProfile | undefined {
    return this.getRescueMates().find(r => r.user_id === userId);
  }

  addRescueMateApplication(application: RescueMateProfile): void {
    const list = [application, ...this.getRescueMates()];
    this.setStorage('rescuemates', list);
  }

  approveRescueMate(applicationId: string, adminUserId: string): void {
    const list = this.getRescueMates().map(r => {
      if (r.id === applicationId) {
        return {
          ...r,
          approval_status: 'approved' as const,
          approved_by: adminUserId,
          approved_at: new Date().toISOString()
        };
      }
      return r;
    });
    this.setStorage('rescuemates', list);

    // Update corresponding user profile to volunteer_approved: true
    const approvedRm = list.find(r => r.id === applicationId);
    if (approvedRm) {
      const user = this.getProfileById(approvedRm.user_id);
      if (user) {
        this.updateProfile({
          ...user,
          is_volunteer: true,
          volunteer_approved: true
        });
      }
    }
  }

  rejectRescueMate(applicationId: string): void {
    const list = this.getRescueMates().map(r => {
      if (r.id === applicationId) {
        return {
          ...r,
          approval_status: 'rejected' as const
        };
      }
      return r;
    });
    this.setStorage('rescuemates', list);
  }

  // --- ATOMIC VOLUNTEER CLAIMING & RACECONDITION PREVENTION ---
  claimMissionAtomic(missionId: string, rescueMate: RescueMateProfile): ClaimMissionResult {
    const missions = this.getMissions();
    const mission = missions.find(m => m.id === missionId);

    if (!mission) {
      return {
        success: false,
        message: 'Rescue mission not found.',
        error: 'NOT_FOUND'
      };
    }

    // Atomic conflict verification: if volunteer already assigned to someone else
    if (mission.volunteer_id && mission.volunteer_id !== rescueMate.user_id) {
      return {
        success: false,
        message: `Mission was already accepted by ${mission.volunteer_name || 'another RescueMate'}. No duplicate assignments permitted.`,
        claimedBy: mission.volunteer_name,
        claimedAt: mission.created_at,
        error: 'ALREADY_CLAIMED'
      };
    }

    // Assign mission atomically
    const updatedMission: RescueMission = {
      ...mission,
      volunteer_id: rescueMate.user_id,
      volunteer_name: rescueMate.full_name,
      volunteer_phone: rescueMate.mobile_number,
      mission_status: 'volunteer_assigned'
    };
    this.updateMission(updatedMission);

    // Update RescueMate active mission
    const updatedRm: RescueMateProfile = {
      ...rescueMate,
      active_mission_id: missionId
    };
    const list = this.getRescueMates().map(r => r.id === rescueMate.id ? updatedRm : r);
    this.setStorage('rescuemates', list);

    // Broadcast LiveSync event across all open client tabs/windows
    this.broadcastLiveSync(
      'MISSION_CLAIMED',
      { missionId, volunteerId: rescueMate.user_id, volunteerName: rescueMate.full_name },
      `RescueMate ${rescueMate.full_name} accepted rescue mission ${mission.batch_id}`
    );

    return {
      success: true,
      message: `Mission locked and assigned to ${rescueMate.full_name}. Proceed to pickup.`,
      claimedBy: rescueMate.full_name,
      claimedAt: new Date().toISOString()
    };
  }

  acceptMissionAsRescueMate(missionId: string, rescueMate: RescueMateProfile): boolean {
    const res = this.claimMissionAtomic(missionId, rescueMate);
    return res.success;
  }

  // --- MEALPULSE AI: LIVESYNC ENGINE ---
  broadcastLiveSync(eventType: LiveSyncEventType, payload: any, summary: string): LiveSyncEvent {
    const syncEvent: LiveSyncEvent = {
      id: `sync-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toISOString(),
      eventType,
      payload,
      summary,
      originClientId: this.clientId
    };

    const history = this.getStorage<LiveSyncEvent[]>('livesync_events', []);
    const updated = [syncEvent, ...history].slice(0, 50);
    this.setStorage('livesync_events', updated);

    if (this.syncChannel) {
      try {
        this.syncChannel.postMessage(syncEvent);
      } catch (e) {
        // ignore
      }
    }

    return syncEvent;
  }

  getLiveSyncEvents(): LiveSyncEvent[] {
    return this.getStorage<LiveSyncEvent[]>('livesync_events', [
      {
        id: 'sync-init-1',
        timestamp: new Date().toISOString(),
        eventType: 'STATUS_CHANGE',
        payload: { engine: 'MealPulse AI' },
        summary: 'MealPulse AI LiveSync network active across connected nodes',
        originClientId: 'system-seed'
      }
    ]);
  }

  getClientId(): string {
    return this.clientId;
  }

  // --- MEALPULSE AI: EVENTPULSE METHODS ---
  getEventRegistrations(): EventRegistration[] {
    return this.getStorage('event_registrations', INITIAL_EVENT_REGISTRATIONS);
  }

  getEventRegistrationById(id: string): EventRegistration | undefined {
    return this.getEventRegistrations().find(e => e.id === id);
  }

  addEventRegistration(event: EventRegistration): EventRegistration {
    const list = [event, ...this.getEventRegistrations()];
    this.setStorage('event_registrations', list);
    this.broadcastLiveSync(
      'EVENT_REGISTERED',
      event,
      `EventPulse: New event scheduled - "${event.event_name}" (${event.approx_guests} guests on ${event.event_date})`
    );
    return event;
  }

  updateEventRegistration(event: EventRegistration): void {
    const list = this.getEventRegistrations().map(e => e.id === event.id ? event : e);
    this.setStorage('event_registrations', list);
  }

  calculateEventPrediction(event: EventRegistration): EventSurplusPrediction {
    const factors: string[] = [];

    // Transparent statistical prediction based on event type, RSVP attrition and buffer
    let attritionRate = 0.12;
    if (event.event_type === 'Wedding' || event.event_type === 'Reception') {
      attritionRate = 0.15;
      factors.push('Traditional wedding banquet RSVP variance: historical 12-16% attendance drop-off');
      factors.push('Caterer safe buffer formula: +15% over anticipated headcount');
    } else if (event.event_type === 'Corporate event') {
      attritionRate = 0.10;
      factors.push('Corporate delegate RSVP pattern: 8-12% average meal skip');
    } else if (event.event_type === 'College celebration') {
      attritionRate = 0.16;
      factors.push('College student crowd fluctuation across multiple campus venues (~16%)');
    } else {
      attritionRate = 0.11;
      factors.push('Standard banquet food service margin (10-12%)');
    }

    const plannedBuffer = Math.max(0, event.planned_meals - event.approx_guests);
    if (plannedBuffer > 0) {
      factors.push(`Explicit planned meal buffer: ${plannedBuffer} additional portions ordered`);
    }

    if (event.meal_type === 'Dinner') {
      factors.push('Dinner service pattern: reduced guest appetite after evening snacks');
    }

    if (event.prep_arrangement === 'External provider') {
      factors.push('External caterer margin: commercial hedge against running out (+5% surplus tendency)');
    }

    const estimatedMealsRequired = Math.round(event.approx_guests * (1 - attritionRate * 0.5));
    const estimatedSurplusMin = Math.max(20, Math.round((event.planned_meals - estimatedMealsRequired) * 0.7));
    const estimatedSurplusMax = Math.max(estimatedSurplusMin + 20, Math.round((event.planned_meals - estimatedMealsRequired) * 1.3));
    const avgPortions = Math.round((estimatedSurplusMin + estimatedSurplusMax) / 2);
    const estimatedSurplusKg = Math.round(avgPortions * 0.4);

    const orgs = this.getOrganizations();
    const nearbyRecipientCandidates = [
      {
        id: orgs[0]?.id || 'org-ngo-1',
        name: orgs[0]?.organisation_name || 'Anbalayam Children Shelter',
        type: 'Orphanage',
        requirementPortions: 40,
        distanceKm: 2.8
      },
      {
        id: orgs[1]?.id || 'org-ngo-2',
        name: orgs[1]?.organisation_name || 'Karunai Illam Destitute Home',
        type: 'Old Age Home',
        requirementPortions: 25,
        distanceKm: 3.4
      },
      {
        id: 'hub-cbe-001',
        name: 'Lions Community Feeding Centre',
        type: 'Community Kitchen',
        requirementPortions: 30,
        distanceKm: 4.1
      }
    ];

    return {
      eventId: event.id,
      estimatedMealsRequired,
      estimatedSurplusMin,
      estimatedSurplusMax,
      estimatedSurplusKg,
      confidence: event.approx_guests >= 300 ? 'High' : 'Medium',
      expectedAvailabilityTime: event.expected_end_time || '21:30',
      influencingFactors: factors,
      nearbyRecipientCandidates,
      generatedAt: new Date().toISOString()
    };
  }

  getEventInterests(eventId?: string): EventInterestRegistration[] {
    const list = this.getStorage('event_interests', INITIAL_EVENT_INTERESTS);
    return eventId ? list.filter(i => i.eventId === eventId) : list;
  }

  registerEventInterest(interest: EventInterestRegistration): EventInterestRegistration {
    const list = [interest, ...this.getEventInterests()];
    this.setStorage('event_interests', list);
    this.broadcastLiveSync(
      'INTEREST_REGISTERED',
      interest,
      `Interest Registered: ${interest.recipientName} requested ${interest.portionsNeeded} meals from event`
    );
    return interest;
  }

  confirmActualEventSurplus(
    eventId: string,
    actualPortions: number,
    actualKg: number,
    notes?: string
  ): FoodListing | null {
    const event = this.getEventRegistrationById(eventId);
    if (!event) return null;

    const updatedEvent: EventRegistration = {
      ...event,
      status: 'surplus_confirmed',
      actual_surplus_portions: actualPortions,
      actual_surplus_kg: actualKg,
      confirmed_at: new Date().toISOString(),
      notes: notes || event.notes
    };
    this.updateEventRegistration(updatedEvent);

    // Create a verified FoodListing ready for rescue
    const newListing: FoodListing = {
      id: `lst-${Date.now()}`,
      batch_id: `UNV-EVT-${Date.now().toString().slice(-4)}`,
      donor_id: event.organizer_id,
      donor_name: event.organizer_name,
      food_name: `${event.event_name} - Fresh Surplus`,
      description: `Verified fresh surplus from ${event.event_name} (${event.event_type}). Prepared by ${event.caterer_name || event.organizer_name}.`,
      food_category: (event.food_categories[0] as any) || 'Cooked Meals',
      dietary_category: 'Vegetarian',
      quantity: actualKg,
      unit: 'kg',
      estimated_portions: actualPortions,
      preparation_time: new Date().toISOString(),
      storage_information: 'Insulated commercial thermal vessels with temperature maintained above 60°C',
      temperature_celsius: 65,
      allergens: [],
      packaging_information: 'Food-grade stainless steel thermal vessels',
      handling_information: 'Immediate transfer to verified recipient within 90 mins recommended',
      permitted_handling_deadline: new Date(Date.now() + 4 * 3600000).toISOString(),
      pickup_location: event.location_name,
      latitude: event.latitude,
      longitude: event.longitude,
      pickup_start: new Date().toISOString(),
      pickup_end: new Date(Date.now() + 2 * 3600000).toISOString(),
      safety_status: 'eligible',
      listing_status: 'available',
      is_emergency: false,
      created_at: new Date().toISOString()
    };

    this.addListing(newListing);

    this.broadcastLiveSync(
      'SURPLUS_CONFIRMED',
      { eventId, listingId: newListing.id, portions: actualPortions, kg: actualKg },
      `Surplus confirmed for "${event.event_name}": ${actualPortions} meals (${actualKg} kg) available for rescue!`
    );

    return newListing;
  }

  // --- MEALPULSE AI: HOSTELPULSE METHODS ---
  getHostelProfiles(): HostelProfile[] {
    return this.getStorage('hostel_profiles', INITIAL_HOSTEL_PROFILES);
  }

  getHostelProfileById(id: string): HostelProfile | undefined {
    return this.getHostelProfiles().find(h => h.id === id);
  }

  addHostelProfile(profile: HostelProfile): void {
    const list = [profile, ...this.getHostelProfiles()];
    this.setStorage('hostel_profiles', list);
  }

  getHostelMealPlans(hostelId?: string): HostelDailyMealPlan[] {
    const list = this.getStorage('hostel_meal_plans', INITIAL_HOSTEL_MEAL_PLANS);
    return hostelId ? list.filter(p => p.hostel_id === hostelId) : list;
  }

  updateHostelMealPlan(plan: HostelDailyMealPlan): void {
    const list = this.getHostelMealPlans().map(p => p.id === plan.id ? plan : p);
    this.setStorage('hostel_meal_plans', list);
    this.broadcastLiveSync('HOSTEL_UPDATED', plan, `Hostel meal plan updated for ${plan.hostel_name} (${plan.meal})`);
  }

  confirmHostelSurplus(
    planId: string, 
    actualPrepared: number, 
    actualServed: number, 
    actualSurplus: number
  ): FoodListing | null {
    const plans = this.getHostelMealPlans();
    const plan = plans.find(p => p.id === planId);
    if (!plan) return null;

    const updatedPlan: HostelDailyMealPlan = {
      ...plan,
      actual_prepared: actualPrepared,
      actual_served: actualServed,
      actual_surplus: actualSurplus,
      status: 'surplus_confirmed',
      confirmed_at: new Date().toISOString()
    };
    this.updateHostelMealPlan(updatedPlan);

    const hostel = this.getHostelProfileById(plan.hostel_id);
    const kg = Math.round(actualSurplus * 0.4);

    const newListing: FoodListing = {
      id: `lst-${Date.now()}`,
      batch_id: `UNV-HST-${Date.now().toString().slice(-4)}`,
      donor_id: plan.hostel_id,
      donor_name: hostel?.hostel_name || plan.hostel_name,
      food_name: `${plan.hostel_name} - ${plan.meal} Surplus`,
      description: `Fresh mess surplus from ${plan.hostel_name}. Prepared in clean campus kitchen under institutional food safety standards.`,
      food_category: 'Cooked Meals',
      dietary_category: 'Vegetarian',
      quantity: kg,
      unit: 'kg',
      estimated_portions: actualSurplus,
      preparation_time: new Date().toISOString(),
      storage_information: 'Mess thermal containers, kept covered and warm',
      temperature_celsius: 62,
      allergens: [],
      packaging_information: 'Food-grade mess stainless steel containers',
      handling_information: 'Pickup and delivery within 2 hours recommended',
      permitted_handling_deadline: new Date(Date.now() + 3 * 3600000).toISOString(),
      pickup_location: hostel?.campus_location || 'Campus Dining Gate',
      latitude: hostel?.latitude || 10.8278,
      longitude: hostel?.longitude || 77.0607,
      pickup_start: new Date().toISOString(),
      pickup_end: new Date(Date.now() + 2 * 3600000).toISOString(),
      safety_status: 'eligible',
      listing_status: 'available',
      is_emergency: false,
      created_at: new Date().toISOString()
    };

    this.addListing(newListing);

    this.broadcastLiveSync(
      'SURPLUS_CONFIRMED',
      { planId, listingId: newListing.id, portions: actualSurplus, kg },
      `Campus mess surplus confirmed: ${plan.hostel_name} released ${actualSurplus} ${plan.meal} meals for rescue!`
    );

    return newListing;
  }

  // --- MODULE 8 & 9: CHAT CONVERSATIONS & REAL-TIME INBOX ---
  getConversations(): ChatConversation[] {
    return this.getStorage('conversations', INITIAL_CONVERSATIONS);
  }

  getConversationById(id: string): ChatConversation | undefined {
    return this.getConversations().find(c => c.id === id);
  }

  getMessagesByConversationId(conversationId: string): ChatMessage[] {
    const all = this.getStorage('chat_messages', INITIAL_CHAT_MESSAGES);
    return all.filter(m => m.conversation_id === conversationId);
  }

  sendMessage(
    conversationId: string, 
    senderId: string, 
    senderName: string, 
    senderRole: UserRole, 
    content: string, 
    messageType: 'text' | 'image' | 'predefined_action' | 'system' = 'text'
  ): ChatMessage {
    const all = this.getStorage('chat_messages', INITIAL_CHAT_MESSAGES);
    const newMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      conversation_id: conversationId,
      sender_id: senderId,
      sender_name: senderName,
      sender_role: senderRole,
      message_type: messageType,
      content,
      delivery_status: 'sent',
      created_at: new Date().toISOString()
    };

    this.setStorage('chat_messages', [...all, newMsg]);

    // Update conversation last message preview
    const convs = this.getConversations().map(c => {
      if (c.id === conversationId) {
        return {
          ...c,
          last_message_text: content,
          last_message_time: new Date().toISOString()
        };
      }
      return c;
    });
    this.setStorage('conversations', convs);

    return newMsg;
  }

  getOrCreateMissionConversation(mission: RescueMission, currentUserId: string): ChatConversation {
    const convs = this.getConversations();
    let found = convs.find(c => c.related_mission_id === mission.id);

    if (!found) {
      found = {
        id: `conv-${mission.id}`,
        conversation_type: 'donor_rescuemate',
        title: `Mission ${mission.batch_id} Coordination`,
        related_donation_id: mission.food_listing_id,
        related_batch_id: mission.batch_id,
        related_mission_id: mission.id,
        food_name: mission.food_name,
        pickup_address: mission.pickup_address,
        delivery_address: mission.delivery_address,
        mission_status: mission.mission_status,
        participant_ids: [mission.donor_id, mission.recipient_id, mission.volunteer_id || currentUserId],
        last_message_text: `Mission initialized. Ready for pickup.`,
        last_message_time: new Date().toISOString(),
        unread_count: 0,
        created_at: new Date().toISOString()
      };
      this.setStorage('conversations', [found, ...convs]);
    }

    return found;
  }

  // --- MODULE 8.3: WHATSAPP CONFIGURATION ---
  getWhatsAppConfig(): WhatsAppIntegrationConfig {
    return this.getStorage('whatsapp_config', INITIAL_WHATSAPP_CONFIG);
  }

  updateWhatsAppConfig(config: Partial<WhatsAppIntegrationConfig>): WhatsAppIntegrationConfig {
    const current = this.getWhatsAppConfig();
    const updated = { ...current, ...config };
    this.setStorage('whatsapp_config', updated);
    return updated;
  }

  // --- MODULE 10: NOTIFICATION PREFERENCES ---
  getNotificationPreferences(userId?: string): NotificationPreferences {
    return this.getStorage('notification_prefs', INITIAL_NOTIFICATION_PREFERENCES);
  }

  updateNotificationPreferences(prefs: NotificationPreferences): void {
    this.setStorage('notification_prefs', prefs);
  }

  // --- MODULE 7: IMPACT LEDGER & VERIFIED TRACEABILITY ---
  getImpactLedger() {
    const listings = this.getListings();
    const missions = this.getMissions();
    const distributions = this.getDistributions();

    return listings.map(l => {
      const mission = missions.find(m => m.food_listing_id === l.id || m.batch_id === l.batch_id);
      const dist = distributions.find(d => d.batch_id === l.batch_id);

      const isListed = true;
      const isApproved = l.listing_status !== 'draft' && l.listing_status !== 'rejected';
      const isAllocated = Boolean(mission);
      const isPickedUp = mission?.mission_status === 'picked_up' || mission?.mission_status === 'in_transit' || mission?.mission_status === 'delivered' || mission?.mission_status === 'completed';
      const isReceived = mission?.mission_status === 'delivered' || mission?.mission_status === 'completed';
      const isDistributed = Boolean(dist && dist.quantity_distributed_kg > 0);
      const isServed = Boolean(dist && dist.meals_served_count > 0);

      return {
        batchId: l.batch_id,
        foodName: l.food_name,
        donorName: l.donor_name || 'Verified Kitchen',
        donorId: l.donor_id,
        quantityKg: l.quantity,
        portions: l.estimated_portions,
        category: l.food_category,
        recipientName: mission?.recipient_name || dist?.distribution_location || 'Pending Allocation',
        rescueMateName: mission?.volunteer_name || 'Unassigned',
        stages: {
          listed: { status: isListed, timestamp: l.created_at },
          approved: { status: isApproved, timestamp: l.created_at },
          allocated: { status: isAllocated, timestamp: mission?.created_at },
          pickedUp: { status: isPickedUp, timestamp: mission?.created_at },
          received: { status: isReceived, timestamp: dist?.distribution_time },
          distributed: { status: isDistributed, timestamp: dist?.distribution_time },
          served: { status: isServed, timestamp: dist?.distribution_time }
        },
        verifiedCredits: isServed ? Math.round(l.estimated_portions * 1.5) : 0,
        safetyStatus: l.safety_status
      };
    });
  }

  // RESET TO DEMO DEFAULT
  resetDemoData(): void {
    localStorage.clear();
    this.emitChange();
  }
}

export const store = new UnavuLinkStore();

// React hook for component reactivity
export function useStoreState(): UnavuLinkStore {
  const [, setTick] = (window as any).React 
    ? (window as any).React.useState(0) 
    : [0, () => {}];
  return store;
}

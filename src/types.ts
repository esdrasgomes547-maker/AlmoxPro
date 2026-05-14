export interface InventoryItem {
  id: string;
  name: string;
  category: string;
  location: string;
  qty: number;
  minQty: number;
  price: number;
  status: 'OK' | 'WARNING' | 'CRITICAL' | 'OUT_OF_STOCK';
}

export interface Category {
  id: string;
  name: string;
  description: string;
  purpose: string;
  photoUrl?: string;
}

export interface MovementItem {
  id: string;
  type: 'IN' | 'OUT';
  qty: number;
  reason: string;
  date: string;
  user: string;
  userEmail: string;
}

export interface ShipmentItem {
  id: string;
  destination: string;
  items: number;
  driver?: string;
  vehicle?: string;
  status: 'CURRENT' | 'DELIVERED' | 'PREPARING' | 'SHIPPED' | 'PENDING';
  date: string;
}

export interface CompanySettings {
  companyName?: string;
  welcomeMessage?: string;
  cn?: string; // or whatever fields exist
}

export interface Organization {
  orgId: string;
  status: 'active' | 'suspended';
  createdAt: string;
}

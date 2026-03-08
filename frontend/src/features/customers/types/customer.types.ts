export type CommunicationMethod = "email" | "sms" | "both";

export interface CustomerAddress {
  street: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
}

export interface EmergencyContact {
  name: string;
  phone: string;
  relationship: string;
}

export interface CustomerPreferences {
  communicationMethod: CommunicationMethod;
  reminders: boolean;
}

export interface Customer {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  address?: CustomerAddress;
  dateOfBirth?: Date;
  emergencyContact?: EmergencyContact;
  medicalHistory?: string;
  preferences?: CustomerPreferences;
  createdAt: Date;
  updatedAt: Date;
}

export interface CustomerProfile {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
}

export interface CustomerFilter {
  email?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  createdAfter?: Date;
  createdBefore?: Date;
}

export interface CustomerCreateRequest {
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  address?: CustomerAddress;
  dateOfBirth?: string;
  emergencyContact?: EmergencyContact;
  medicalHistory?: string;
  preferences?: CustomerPreferences;
}

export interface CustomerUpdateRequest {
  firstName?: string;
  lastName?: string;
  phone?: string;
  address?: CustomerAddress;
  dateOfBirth?: string;
  emergencyContact?: EmergencyContact;
  medicalHistory?: string;
  preferences?: CustomerPreferences;
}

export interface RegistrationField {
  id: number;
  name: string;
  field_type: 'text' | 'number' | 'date' | 'checkbox' | 'select';
  options: string[];
  is_required: boolean;
}
export interface RegistrationForm {
  id: number;
  title: string;
  description: string;
  public_field_ids: number[];
  is_active: boolean;
  token: string;
  url: string;
  print_url: string;
}
export interface RegistrationRequest {
  id: number;
  form_id: number;
  name: string;
  phone: string | null;
  birthday: string | null;
  answers: Record<string, string | null>;
  fields: RegistrationField[];
  status: string;
  student_id: number | null;
  created_at: string;
}
export interface PublicRegistration {
  title: string;
  description: string;
  tahfiz_name: string;
  fields: RegistrationField[];
}
export const REGISTRATION_API = '/student-registration';

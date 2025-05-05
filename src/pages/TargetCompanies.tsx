import React, { useState, useEffect } from 'react';
import { Plus, ExternalLink, Pencil, Trash2, User } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useSelector } from 'react-redux'; // Import useSelector
import { suggestNetworkingActions } from '../lib/openai';
import type { Database } from '../lib/supabase-types';

type Company = Database['public']['Tables']['companies']['Row'];

const TargetCompanies = () => {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    website: '',
    notes: '',
    status: 'interested',
    contact_name: '',
    contact_email: '',
    contact_phone: '',
    contact_role: ''
  });
  const user = useSelector((state: any) => state.auth.user); // Use useSelector

  useEffect(() => {
    if (user) {
      fetchCompanies();
    }
  }, [user]);

  const fetchCompanies = async () => {
    const { data } = await supabase
      .from('companies')
      .select('*')
      .eq('user_id', user!.id)
      .order('created_at', { ascending: false });

    if (data) setCompanies(data);
  };

  const generateNetworkingSuggestions = async (company: Company) => {
    try {
      const suggestions = await suggestNetworkingActions([company]);
      const { error } = await supabase
        .from('companies')
        .update({
          notes: company.notes ? `${company.notes}\n\nNetworking Suggestions:\n${suggestions}` : `Networking Suggestions:\n${suggestions}`,
          updated_at: new Date().toISOString()
        })
        .eq('id', company.id);

      if (!error) {
        fetchCompanies();
      }
    } catch (error) {
      console.error('Error generating networking suggestions:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (editingId) {
      const { error, data } = await supabase
        .from('companies')
        .update({
          ...formData,
          updated_at: new Date().toISOString()
        })
        .eq('id', editingId)
        .select()
        .single();

      if (!error && data) {
        setEditingId(null);
        generateNetworkingSuggestions(data);
        fetchCompanies();
      }
    } else {
      const { error, data } = await supabase
        .from('companies')
        .insert([
          {
            ...formData,
            user_id: user.id
          }
        ])
        .select()
        .single();

      if (!error && data) {
        setIsAdding(false);
        generateNetworkingSuggestions(data);
        fetchCompanies();
      }
    }

    setFormData({
      name: '',
      website: '',
      notes: '',
      status: 'interested',
      contact_name: '',
      contact_email: '',
      contact_phone: '',
      contact_role: ''
    });
  };

  const handleEdit = (company: Company) => {
    setEditingId(company.id);
    setFormData({
      name: company.name,
      website: company.website || '',
      notes: company.notes || '',
      status: company.status,
      contact_name: company.contact_name || '',
      contact_email: company.contact_email || '',
      contact_phone: company.contact_phone || '',
      contact_role: company.contact_role || ''
    });
    setIsAdding(true);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase
      .from('companies')
      .delete()
      .eq('id', id);

    if (!error) {
      fetchCompanies();
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Target Companies</h1>
        <button
          onClick={() => setIsAdding(true)}
          className="bg-primary text-primary-foreground px-4 py-2 rounded-md flex items-center gap-2"
        >
          <Plus className="h-5 w-5" />
          Add Company
        </button>
      </div>

      {isAdding && (
        <div className="bg-card text-card-foreground p-6 rounded-lg shadow-md mb-6">
          <h2 className="text-xl font-semibold mb-4">
            {editingId ? 'Edit Company' : 'Add New Company'}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="name" className="block text-sm font-medium mb-1">
                  Company Name
                </label>
                <input
                  id="name"
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full p-2 rounded border border-input bg-background"
                  required
                />
              </div>
              <div>
                <label htmlFor="website" className="block text-sm font-medium mb-1">
                  Website
                </label>
                <input
                  id="website"
                  type="url"
                  value={formData.website}
                  onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                  className="w-full p-2 rounded border border-input bg-background"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="contact_name" className="block text-sm font-medium mb-1">
                  Contact Name
                </label>
                <input
                  id="contact_name"
                  type="text"
                  value={formData.contact_name}
                  onChange={(e) => setFormData({ ...formData, contact_name: e.target.value })}
                  className="w-full p-2 rounded border border-input bg-background"
                />
              </div>
              <div>
                <label htmlFor="contact_role" className="block text-sm font-medium mb-1">
                  Contact Role
                </label>
                <input
                  id="contact_role"
                  type="text"
                  value={formData.contact_role}
                  onChange={(e) => setFormData({ ...formData, contact_role: e.target.value })}
                  className="w-full p-2 rounded border border-input bg-background"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="contact_email" className="block text-sm font-medium mb-1">
                  Contact Email
                </label>
                <input
                  id="contact_email"
                  type="email"
                  value={formData.contact_email}
                  onChange={(e) => setFormData({ ...formData, contact_email: e.target.value })}
                  className="w-full p-2 rounded border border-input bg-background"
                />
              </div>
              <div>
                <label htmlFor="contact_phone" className="block text-sm font-medium mb-1">
                  Contact Phone
                </label>
                <input
                  id="contact_phone"
                  type="tel"
                  value={formData.contact_phone}
                  onChange={(e) => setFormData({ ...formData, contact_phone: e.target.value })}
                  className="w-full p-2 rounded border border-input bg-background"
                />
              </div>
            </div>

            <div>
              <label htmlFor="notes" className="block text-sm font-medium mb-1">
                Notes
              </label>
              <textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="w-full p-2 rounded border border-input bg-background"
                rows={3}
              />
            </div>

            <div>
              <label htmlFor="status" className="block text-sm font-medium mb-1">
                Status
              </label>
              <select
                id="status"
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                className="w-full p-2 rounded border border-input bg-background"
              >
                <option value="interested">Interested</option>
                <option value="researching">Researching</option>
                <option value="applying">Ready to Apply</option>
                <option value="not_interested">Not Interested</option>
              </select>
            </div>

            <div className="flex gap-2">
              <button
                type="submit"
                className="bg-primary text-primary-foreground px-4 py-2 rounded-md"
              >
                {editingId ? 'Update' : 'Add'} Company
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsAdding(false);
                  setEditingId(null);
                  setFormData({
                    name: '',
                    website: '',
                    notes: '',
                    status: 'interested',
                    contact_name: '',
                    contact_email: '',
                    contact_phone: '',
                    contact_role: ''
                  });
                }}
                className="bg-muted text-muted-foreground px-4 py-2 rounded-md"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {companies.map((company) => (
          <div key={company.id} className="bg-card text-card-foreground p-6 rounded-lg shadow-md">
            <div className="flex justify-between items-start mb-4">
              <h2 className="text-xl font-semibold">{company.name}</h2>
              <div className="flex gap-2">
                <button
                  onClick={() => handleEdit(company)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <Pencil className="h-5 w-5" />
                </button>
                <button
                  onClick={() => handleDelete(company.id)}
                  className="text-destructive hover:text-destructive/80"
                >
                  <Trash2 className="h-5 w-5" />
                </button>
              </div>
            </div>

            {company.website && (
              <a
                href={company.website}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline flex items-center gap-1 mb-2"
              >
                Visit website
                <ExternalLink className="h-4 w-4" />
              </a>
            )}

            {(company.contact_name || company.contact_email || company.contact_phone || company.contact_role) && (
              <div className="border-t border-border mt-4 pt-4 mb-4">
                <h3 className="text-sm font-medium flex items-center gap-1 mb-2">
                  <User className="h-4 w-4" />
                  Point of Contact
                </h3>
                {company.contact_name && (
                  <p className="text-sm">
                    <span className="font-medium">Name:</span> {company.contact_name}
                    {company.contact_role && ` (${company.contact_role})`}
                  </p>
                )}
                {company.contact_email && (
                  <p className="text-sm">
                    <span className="font-medium">Email:</span>{' '}
                    <a
                      href={`mailto:${company.contact_email}`}
                      className="text-primary hover:underline"
                    >
                      {company.contact_email}
                    </a>
                  </p>
                )}
                {company.contact_phone && (
                  <p className="text-sm">
                    <span className="font-medium">Phone:</span>{' '}
                    <a
                      href={`tel:${company.contact_phone}`}
                      className="text-primary hover:underline"
                    >
                      {company.contact_phone}
                    </a>
                  </p>
                )}
              </div>
            )}

            {company.notes && (
              <p className="text-muted-foreground text-sm mb-4">{company.notes}</p>
            )}

            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Status:</span>
              <span className="text-sm capitalize">{company.status}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default TargetCompanies;
"use client"
import React, { useEffect, useState, FormEvent } from 'react'

type EventItem = {
    id: number
    neName: string
    neRelation?: string | null
    neType?: string
    neDateLastModified?: string | null
    neCount?: number
    EventDate?: string | null
}

export default function ManageEvents() {
    const [events, setEvents] = useState<EventItem[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const [newName, setNewName] = useState('')
    const [newDate, setNewDate] = useState('')
    const [newDesc, setNewDesc] = useState('')
    const [newEventDate, setNewEventDate] = useState('')

    const [editingId, setEditingId] = useState<number | null>(null)
    const [editName, setEditName] = useState('')
    const [editDate, setEditDate] = useState('')
    const [editDesc, setEditDesc] = useState('')
    const [editEventDate, setEditEventDate] = useState('')

    useEffect(() => {
        fetchEvents()
    }, [])

    async function fetchEvents() {
        setLoading(true)
        setError(null)
        try {
            const res = await fetch('/api/events')
            if (!res.ok) throw new Error(`Failed to load events (${res.status})`)
            const data = await res.json()
            setEvents(data.success ? data.events : (Array.isArray(data) ? data : [])) // Handle both formats
        } catch (err: any) {
            setError(err?.message ?? 'Unknown error')
        } finally {
            setLoading(false)
        }
    }

    async function handleCreate(e: FormEvent) {
        e.preventDefault()
        if (!newName.trim()) return
        setError(null)
        try {
            // The backend expects NameEvent fields; people API uses { name } on POST
            const payload: any = { name: newName.trim() }
            // If user provided a description, send as relation (neRelation)
            if (newDesc) payload.relation = newDesc
            if (newEventDate) payload.eventDate = newEventDate

            const res = await fetch('/api/events', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            })
            if (!res.ok) throw new Error(`Create failed (${res.status})`)
            const created = await res.json()
            // Normalize shape: created may contain id and name
            const ev: EventItem = {
                id: created.id ?? created.ID,
                neName: created.name ?? created.neName ?? newName,
                neRelation: created.relation ?? created.neRelation ?? newDesc ?? null,
                neType: 'E',
                neDateLastModified: created.neDateLastModified ?? null,
                neCount: created.photoCount ?? created.neCount ?? 0,
                EventDate: created.eventDate ?? created.EventDate ?? newEventDate ?? null,
            }
            setEvents(prev => [ev, ...prev])
            setNewName('')
            setNewDate('')
            setNewDesc('')
            setNewEventDate('')
        } catch (err: any) {
            setError(err?.message ?? 'Create error')
        }
    }

    function startEdit(ev: EventItem) {
        setEditingId(ev.id)
        setEditName(ev.neName)
        setEditDate(ev.neDateLastModified ?? '')
        setEditDesc(ev.neRelation ?? '')
        setEditEventDate(ev.EventDate ?? '')
    }

    function cancelEdit() {
        setEditingId(null)
        setEditName('')
        setEditDate('')
        setEditDesc('')
        setEditEventDate('')
    }

    async function handleUpdate(e: FormEvent) {
        e.preventDefault()
        if (editingId == null) return
        setError(null)
        try {
            const payload: any = { id: editingId, name: editName }
            if (editDesc) payload.relation = editDesc
            if (editEventDate) payload.eventDate = editEventDate

            console.log('🔍 Updating event:', payload);

            // PUT to /api/events (with ID in body, like people API)
            const res = await fetch(`/api/events`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            })
            
            console.log('📡 Response status:', res.status);
            
            if (!res.ok) {
                const data = await res.json();
                console.error('❌ Update failed:', data);
                const errorMsg = data.error || `Update failed (${res.status})`;
                setError(errorMsg);
                alert('Error updating event: ' + errorMsg); // Show alert too
                throw new Error(errorMsg);
            }
            
            const updated = await res.json()
            console.log('✅ Update successful:', updated);
            
            const ev: EventItem = {
                id: updated.event?.ID ?? editingId,
                neName: updated.event?.neName ?? editName,
                neRelation: updated.event?.neRelation ?? editDesc ?? null,
                neType: 'E',
                neDateLastModified: updated.event?.neDateLastModified ?? null,
                neCount: updated.event?.neCount ?? 0,
                EventDate: updated.event?.EventDate ?? editEventDate ?? null,
            }
            setEvents(prev => prev.map(x => (x.id === editingId ? ev : x)))
            cancelEdit()
        } catch (err: any) {
            console.error('💥 Update error:', err);
            const errorMsg = err?.message ?? 'Update error';
            setError(errorMsg);
            if (!errorMsg.includes('failed')) { // Don't double-alert
                alert('Error updating event: ' + errorMsg);
            }
        }
    }

    async function handleDelete(id: number) {
        if (!confirm('Delete this event?')) return
        setError(null)
        try {
            // DELETE to /api/events/{id}
            const res = await fetch(`/api/events/${id}`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
            })
            if (!res.ok && res.status !== 204) {
                const data = await res.json();
                throw new Error(data.error || `Delete failed (${res.status})`);
            }
            setEvents(prev => prev.filter(ev => ev.id !== id))
        } catch (err: any) {
            setError(err?.message ?? 'Delete error')
        }
    }

    return (
        <div style={{ maxWidth: 900, margin: '0 auto', padding: 16 }}>
            <h2>Manage Events</h2>

            <section style={{ marginBottom: 24, padding: 16, backgroundColor: '#f5f5f5', borderRadius: 8 }}>
                <h3 style={{ marginTop: 0 }}>Create New Event</h3>
                <form onSubmit={handleCreate} style={{ display: 'grid', gap: 10 }}>
                    <div>
                        <label style={{ display: 'block', marginBottom: 4, fontWeight: 500, fontSize: 13 }}>
                            Event Name *
                        </label>
                        <input
                            placeholder="e.g., Summer Vacation 2024"
                            value={newName}
                            onChange={e => setNewName(e.target.value)}
                            required
                            style={{ width: '100%', padding: 8 }}
                        />
                    </div>
                    <div>
                        <label style={{ display: 'block', marginBottom: 4, fontWeight: 500, fontSize: 13 }}>
                            📅 Event Date
                        </label>
                        <input
                            type="date"
                            placeholder="Event date (optional)"
                            value={newEventDate}
                            onChange={e => setNewEventDate(e.target.value)}
                            style={{ width: '100%', padding: 8 }}
                        />
                    </div>
                    <div>
                        <label style={{ display: 'block', marginBottom: 4, fontWeight: 500, fontSize: 13 }}>
                            Description
                        </label>
                        <input
                            placeholder="Optional description"
                            value={newDesc}
                            onChange={e => setNewDesc(e.target.value)}
                            style={{ width: '100%', padding: 8 }}
                        />
                    </div>
                    <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                        <button type="submit" style={{ padding: '8px 16px', fontWeight: 500 }}>
                            ➕ Create Event
                        </button>
                        <button type="button" onClick={() => { setNewName(''); setNewDate(''); setNewDesc(''); setNewEventDate('') }} style={{ padding: '8px 16px' }}>
                            Clear
                        </button>
                    </div>
                </form>
            </section>

            <section>
                <h3>Existing Events</h3>
                {loading && <div>Loading...</div>}
                {error && <div style={{ color: 'red' }}>{error}</div>}
                {!loading && events.length === 0 && <div>No events found.</div>}

                <ul style={{ listStyle: 'none', padding: 0 }}>
                    {events.map(ev => (
                        <li key={ev.id} style={{ border: '1px solid #ddd', padding: 12, marginBottom: 8 }}>
                            {editingId === ev.id ? (
                                <form onSubmit={handleUpdate} style={{ display: 'grid', gap: 10 }}>
                                    <div>
                                        <label style={{ display: 'block', marginBottom: 4, fontWeight: 500, fontSize: 13 }}>
                                            Event Name *
                                        </label>
                                        <input 
                                            value={editName} 
                                            onChange={e => setEditName(e.target.value)} 
                                            placeholder="Event name" 
                                            required 
                                            style={{ width: '100%', padding: 8 }}
                                        />
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', marginBottom: 4, fontWeight: 500, fontSize: 13 }}>
                                            📅 Event Date
                                        </label>
                                        <input 
                                            type="date" 
                                            value={editEventDate ?? ''} 
                                            onChange={e => setEditEventDate(e.target.value)} 
                                            placeholder="Event date"
                                            style={{ width: '100%', padding: 8 }}
                                        />
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', marginBottom: 4, fontWeight: 500, fontSize: 13 }}>
                                            Description
                                        </label>
                                        <input 
                                            value={editDesc ?? ''} 
                                            onChange={e => setEditDesc(e.target.value)} 
                                            placeholder="Description" 
                                            style={{ width: '100%', padding: 8 }}
                                        />
                                    </div>
                                    <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                                        <button type="submit" style={{ padding: '8px 16px', fontWeight: 500 }}>
                                            ✓ Save
                                        </button>
                                        <button type="button" onClick={cancelEdit} style={{ padding: '8px 16px' }}>
                                            Cancel
                                        </button>
                                    </div>
                                </form>
                            ) : (
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ marginBottom: 4 }}>
                                            <strong style={{ fontSize: 16 }}>{ev.neName}</strong>
                                            {ev.EventDate && (
                                                <span style={{ 
                                                    marginLeft: 12, 
                                                    padding: '2px 8px', 
                                                    backgroundColor: '#e3f2fd', 
                                                    borderRadius: 4, 
                                                    fontSize: 13,
                                                    color: '#1976d2',
                                                    fontWeight: 500
                                                }}>
                                                    📅 {new Date(ev.EventDate).toLocaleDateString('en-US', { 
                                                        year: 'numeric', 
                                                        month: 'short', 
                                                        day: 'numeric' 
                                                    })}
                                                </span>
                                            )}
                                        </div>
                                        <div style={{ fontSize: 13, color: '#666' }}>
                                            {ev.neRelation && <span>{ev.neRelation} · </span>}
                                            <span>{ev.neCount || 0} photo{(ev.neCount || 0) !== 1 ? 's' : ''}</span>
                                            {!ev.EventDate && <span style={{ color: '#999', fontStyle: 'italic' }}> · No date set</span>}
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', gap: 8 }}>
                                        <button onClick={() => startEdit(ev)} style={{ 
                                            padding: '6px 12px',
                                            cursor: 'pointer'
                                        }}>Edit</button>
                                        <button onClick={() => handleDelete(ev.id)} style={{ 
                                            marginLeft: 4,
                                            padding: '6px 12px',
                                            color: 'red',
                                            cursor: 'pointer'
                                        }}>Delete</button>
                                    </div>
                                </div>
                            )}
                        </li>
                    ))}
                </ul>

                <div style={{ marginTop: 12 }}>
                    <button onClick={fetchEvents}>Refresh</button>
                </div>
            </section>
        </div>
    )
}

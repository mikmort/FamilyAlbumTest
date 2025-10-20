"use client"
import React, { useEffect, useState, FormEvent } from 'react'

type EventItem = {
    id: number
    neName: string
    neRelation?: string | null
    neType?: string
    neDateLastModified?: string | null
    neCount?: number
}

export default function ManageEvents() {
    const [events, setEvents] = useState<EventItem[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const [newName, setNewName] = useState('')
    const [newDate, setNewDate] = useState('')
    const [newDesc, setNewDesc] = useState('')

    const [editingId, setEditingId] = useState<number | null>(null)
    const [editName, setEditName] = useState('')
    const [editDate, setEditDate] = useState('')
    const [editDesc, setEditDesc] = useState('')

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
            setEvents(Array.isArray(data) ? data : [])
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
            }
            setEvents(prev => [ev, ...prev])
            setNewName('')
            setNewDate('')
            setNewDesc('')
        } catch (err: any) {
            setError(err?.message ?? 'Create error')
        }
    }

    function startEdit(ev: EventItem) {
        setEditingId(ev.id)
        setEditName(ev.neName)
        setEditDate(ev.neDateLastModified ?? '')
        setEditDesc(ev.neRelation ?? '')
    }

    function cancelEdit() {
        setEditingId(null)
        setEditName('')
        setEditDate('')
        setEditDesc('')
    }

    async function handleUpdate(e: FormEvent) {
        e.preventDefault()
        if (editingId == null) return
        setError(null)
        try {
            const payload: any = { id: editingId, name: editName }
            if (editDesc) payload.relation = editDesc

            // People API uses PUT on /api/people; events backend currently doesn't implement PUT here
            const res = await fetch(`/api/events`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            })
            if (!res.ok) throw new Error(`Update failed (${res.status})`)
            const updated = await res.json()
            const ev: EventItem = {
                id: updated.id ?? updated.ID,
                neName: updated.name ?? updated.neName ?? editName,
                neRelation: updated.relation ?? updated.neRelation ?? editDesc ?? null,
                neType: 'E',
                neDateLastModified: updated.neDateLastModified ?? null,
                neCount: updated.photoCount ?? updated.neCount ?? 0,
            }
            setEvents(prev => prev.map(x => (x.id === editingId ? ev : x)))
            cancelEdit()
        } catch (err: any) {
            setError(err?.message ?? 'Update error')
        }
    }

    async function handleDelete(id: number) {
        if (!confirm('Delete this event?')) return
        setError(null)
        try {
            // Some APIs expect DELETE with body; people API expects body { id }
            const res = await fetch('/api/events', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id }),
            })
            if (!res.ok && res.status !== 204) throw new Error(`Delete failed (${res.status})`)
            setEvents(prev => prev.filter(ev => ev.id !== id))
        } catch (err: any) {
            setError(err?.message ?? 'Delete error')
        }
    }

    return (
        <div style={{ maxWidth: 900, margin: '0 auto', padding: 16 }}>
            <h2>Manage Events</h2>

            <section style={{ marginBottom: 24 }}>
                <h3>Create Event</h3>
                <form onSubmit={handleCreate} style={{ display: 'grid', gap: 8 }}>
                    <input
                        placeholder="Event name"
                        value={newName}
                        onChange={e => setNewName(e.target.value)}
                        required
                    />
                    <input
                        placeholder="Description (optional)"
                        value={newDesc}
                        onChange={e => setNewDesc(e.target.value)}
                    />
                    <div>
                        <button type="submit">Create</button>
                        <button type="button" onClick={() => { setNewName(''); setNewDate(''); setNewDesc('') }} style={{ marginLeft: 8 }}>
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
                                <form onSubmit={handleUpdate} style={{ display: 'grid', gap: 8 }}>
                                    <input value={editName} onChange={e => setEditName(e.target.value)} required />
                                    <input value={editDesc ?? ''} onChange={e => setEditDesc(e.target.value)} />
                                    <div>
                                        <button type="submit">Save</button>
                                        <button type="button" onClick={cancelEdit} style={{ marginLeft: 8 }}>Cancel</button>
                                    </div>
                                </form>
                            ) : (
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div>
                                        <strong>{ev.neName}</strong>
                                        <div style={{ fontSize: 12, color: '#555' }}>
                                            {ev.neDateLastModified ? new Date(ev.neDateLastModified).toLocaleDateString() : 'No date'}
                                            {ev.neRelation ? ` · ${ev.neRelation}` : ''}
                                        </div>
                                    </div>
                                    <div>
                                        <button onClick={() => startEdit(ev)}>Edit</button>
                                        <button onClick={() => handleDelete(ev.id)} style={{ marginLeft: 8, color: 'red' }}>Delete</button>
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

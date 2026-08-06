import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useQueryClient } from '@tanstack/react-query';
import { QUERY_KEYS } from '../api/hooks.js';

interface EscalationEvent {
  hireId:       string;
  hireName:     string;
  taskId:       string;
  taskLabel:    string;
  owner:        string;
  overdueHours: number;
  slaHours:     number;
  timestamp:    string;
}

interface HireUpdatedEvent {
  hireId:  string;
  status:  string;
}

export function useSocket() {
  const qc         = useQueryClient();
  const socketRef  = useRef<Socket | null>(null);

  useEffect(() => {
    const socket = io('/', {
      path:              '/socket.io',
      transports:        ['websocket', 'polling'],
      reconnectionDelay: 1000,
      reconnectionAttempts: 10,
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('[Socket.io] Connected:', socket.id);
    });

    socket.on('disconnect', () => {
      console.log('[Socket.io] Disconnected');
    });

    // Hire status changed (approval / completion)
    socket.on('hire:updated', (evt: HireUpdatedEvent) => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.hire(evt.hireId) });
      qc.invalidateQueries({ queryKey: QUERY_KEYS.hires });
    });

    // SLA breach — invalidate escalations + affected hire
    socket.on('task:escalated', (evt: EscalationEvent) => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.escalations });
      qc.invalidateQueries({ queryKey: QUERY_KEYS.hire(evt.hireId) });
      qc.invalidateQueries({ queryKey: QUERY_KEYS.hires });
    });

    return () => { socket.disconnect(); };
  }, [qc]);

  return socketRef;
}

'use client';

import { useState, useRef, useCallback } from 'react';
import { Mic, MicOff, Loader2, Sparkles } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { apiPost, getApiError } from '@/lib/axios';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';

interface ParsedTask {
  title: string;
  description: string;
  deadline?: string;
  priority?: string;
}

interface Props {
  onTaskParsed: (task: ParsedTask) => void;
}

/**
 * Records a voice note using the Web Speech API (SpeechRecognition).
 * The transcript is sent to the backend AI service which parses it into a
 * task draft. The parsed draft is returned to the parent via `onTaskParsed`.
 *
 * Falls back gracefully if SpeechRecognition is not supported.
 */
export function VoiceTaskButton({ onTaskParsed }: Props) {
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [previewModal, setPreviewModal] = useState(false);
  const [parsed, setParsed] = useState<ParsedTask | null>(null);
  const recognitionRef = useRef<any>(null);

  const isSupported =
    typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

  const { mutate: parseVoice, isPending: parsing } = useMutation({
    mutationFn: (text: string) => apiPost<ParsedTask>('/ai/voice-to-task', { text }),
    onSuccess: (data) => {
      setParsed(data);
      setPreviewModal(true);
    },
    onError: (err) => toast.error(getApiError(err)),
  });

  const startListening = useCallback(() => {
    if (!isSupported) {
      toast.error('Voice input is not supported in this browser. Try Chrome.');
      return;
    }

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.lang = 'en-IN';
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => setListening(true);
    recognition.onend = () => setListening(false);
    recognition.onerror = (e: any) => {
      setListening(false);
      toast.error(`Voice error: ${e.error}`);
    };
    recognition.onresult = (event: any) => {
      const text: string = event.results[0][0].transcript;
      setTranscript(text);
      parseVoice(text);
    };

    recognitionRef.current = recognition;
    recognition.start();
  }, [isSupported, parseVoice]);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    setListening(false);
  }, []);

  const handleConfirm = () => {
    if (!parsed) return;
    onTaskParsed(parsed);
    setPreviewModal(false);
    setParsed(null);
    setTranscript('');
    toast.success('Task draft filled from voice note');
  };

  if (!isSupported) return null;

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant={listening ? 'destructive' : 'outline'}
        icon={
          parsing ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
          : listening ? <MicOff className="h-3.5 w-3.5" />
          : <Mic className="h-3.5 w-3.5 text-red-500" />
        }
        onClick={listening ? stopListening : startListening}
        disabled={parsing}
      >
        {parsing ? 'Parsing…' : listening ? 'Stop' : 'Voice Task'}
      </Button>

      {/* Preview modal */}
      <Modal
        open={previewModal}
        onClose={() => setPreviewModal(false)}
        title="Voice-to-Task Preview"
        size="md"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setPreviewModal(false)}>Discard</Button>
            <Button icon={<Sparkles className="h-4 w-4" />} onClick={handleConfirm}>
              Use This Draft
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          {transcript && (
            <div className="rounded-xl bg-muted/40 border border-border p-3">
              <p className="text-xs font-semibold text-muted-foreground mb-1">You said:</p>
              <p className="text-sm italic text-foreground">"{transcript}"</p>
            </div>
          )}
          {parsed && (
            <div className="flex flex-col gap-2">
              <div>
                <p className="text-xs font-semibold text-muted-foreground">Title</p>
                <p className="text-sm font-medium text-foreground">{parsed.title}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-muted-foreground">Description</p>
                <p className="text-sm text-foreground">{parsed.description}</p>
              </div>
              {parsed.deadline && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground">Deadline</p>
                  <p className="text-sm text-foreground">{parsed.deadline}</p>
                </div>
              )}
              {parsed.priority && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground">Priority</p>
                  <p className="text-sm text-foreground">{parsed.priority}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </Modal>
    </>
  );
}

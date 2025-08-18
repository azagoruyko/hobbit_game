import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

interface BackgroundMusicProps {
  autoPlay?: boolean;
  volume?: number;
}

export function BackgroundMusic({ autoPlay = true, volume = 0.3 }: BackgroundMusicProps) {
  const { t } = useTranslation();
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    audio.volume = volume;
    audio.loop = true;

    const handleCanPlay = () => {
      if (autoPlay && hasInteracted) {
        audio.play().catch(err => {
          console.log('Autoplay failed:', err);
        });
      }
    };

    audio.addEventListener('canplaythrough', handleCanPlay);
    
    return () => {
      audio.removeEventListener('canplaythrough', handleCanPlay);
    };
  }, [autoPlay, volume, hasInteracted]);

  useEffect(() => {
    const handleUserInteraction = () => {
      setHasInteracted(true);
      if (autoPlay) {
        playMusic();
      }
    };

    document.addEventListener('click', handleUserInteraction, { once: true });
    document.addEventListener('keydown', handleUserInteraction, { once: true });

    return () => {
      document.removeEventListener('click', handleUserInteraction);
      document.removeEventListener('keydown', handleUserInteraction);
    };
  }, [autoPlay]);

  const playMusic = async () => {
    const audio = audioRef.current;
    if (audio) {
      try {
        await audio.play();
      } catch (err) {
        console.log('Play failed:', err);
      }
    }
  };

  const toggleMute = () => {
    const audio = audioRef.current;
    if (audio) {
      audio.muted = !audio.muted;
      setIsMuted(!isMuted);
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-10">
      <audio
        ref={audioRef}
        preload="metadata"
      >
        <source src="/main_theme.mp3" type="audio/mpeg" />
        Your browser does not support the audio element.
      </audio>
      
      <button
        onClick={toggleMute}
        className="bg-amber-600 hover:bg-amber-700 text-white p-2 rounded-full shadow-lg transition-colors"
        title={isMuted ? t('common.unmute') : t('common.mute')}
      >
        {isMuted ? '🔇' : '🔊'}
      </button>
    </div>
  );
}
import { Mic, Video, Smartphone, Users, Monitor, Check, Waves } from 'lucide-react';
import { useState, useEffect } from 'react';

interface RecordingModeSelectorProps {
  selectedMode: 'microphone' | 'system' | 'visio';
  onModeChange: (mode: 'microphone' | 'system' | 'visio') => void;
  disabled?: boolean;
}

export const RecordingModeSelector = ({ selectedMode, onModeChange, disabled = false }: RecordingModeSelectorProps) => {
  const [isMobile, setIsMobile] = useState(false);
  
  useEffect(() => {
    const checkMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    setIsMobile(checkMobile);
  }, []);

  const modes = [
    {
      id: 'microphone' as const,
      label: 'Mode Présentiel',
      description: 'Réunion en personne',
      details: 'Capture votre voix via le microphone',
      icon: Mic,
      secondaryIcon: Users,
      gradient: 'from-blue-500 to-indigo-600',
      lightGradient: 'from-blue-50 to-indigo-50',
      borderColor: 'border-blue-200',
      selectedBorder: 'border-blue-500',
      textColor: 'text-blue-700',
      accentColor: 'bg-blue-500',
    },
    {
      id: 'visio' as const,
      label: 'Mode Visio',
      description: 'Réunion en ligne',
      details: 'Capture micro + audio système',
      icon: Video,
      secondaryIcon: Monitor,
      gradient: 'from-purple-500 to-fuchsia-600',
      lightGradient: 'from-purple-50 to-fuchsia-50',
      borderColor: 'border-purple-200',
      selectedBorder: 'border-purple-500',
      textColor: 'text-purple-700',
      accentColor: 'bg-purple-500',
    },
  ];

  return (
    <div className="mb-8">
      <div className="flex items-center gap-2 mb-5">
        <Waves className="w-5 h-5 text-coral-500" />
        <h3 className="text-lg font-bold text-cocoa-800">Mode d'enregistrement</h3>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {modes.map((mode) => {
          const Icon = mode.icon;
          const SecondaryIcon = mode.secondaryIcon;
          const isSelected = selectedMode === mode.id;
          
          return (
            <button
              key={mode.id}
              onClick={() => !disabled && onModeChange(mode.id)}
              disabled={disabled}
              className={`
                relative group overflow-hidden rounded-2xl transition-all duration-300
                ${isSelected 
                  ? `bg-gradient-to-br ${mode.lightGradient} border-2 ${mode.selectedBorder} shadow-lg scale-[1.02]` 
                  : 'bg-white border-2 border-gray-100 hover:border-gray-200 hover:shadow-md hover:scale-[1.01]'
                }
                ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
              `}
            >
              {/* Fond décoratif */}
              <div className={`
                absolute top-0 right-0 w-32 h-32 rounded-full blur-3xl opacity-20 -translate-y-1/2 translate-x-1/2 transition-opacity duration-300
                bg-gradient-to-br ${mode.gradient}
                ${isSelected ? 'opacity-40' : 'opacity-0 group-hover:opacity-20'}
              `} />
              
              <div className="relative p-5">
                <div className="flex items-start gap-4">
                  {/* Icône principale */}
                  <div className={`
                    relative p-3 rounded-xl transition-all duration-300
                    ${isSelected 
                      ? `bg-gradient-to-br ${mode.gradient} shadow-lg` 
                      : 'bg-gray-100 group-hover:bg-gray-200'
                    }
                  `}>
                    <Icon className={`w-6 h-6 ${isSelected ? 'text-white' : 'text-gray-600'}`} />
                    
                    {/* Badge icône secondaire */}
                    <div className={`
                      absolute -bottom-1 -right-1 p-1 rounded-lg transition-all duration-300
                      ${isSelected 
                        ? 'bg-white shadow-md' 
                        : 'bg-gray-50 border border-gray-200'
                      }
                    `}>
                      <SecondaryIcon className={`w-3 h-3 ${isSelected ? mode.textColor : 'text-gray-500'}`} />
                    </div>
                  </div>
                  
                  {/* Texte */}
                  <div className="flex-1 text-left">
                    <div className="flex items-center gap-2">
                      <h4 className={`font-bold ${isSelected ? mode.textColor : 'text-gray-800'}`}>
                        {mode.label}
                      </h4>
                      {isSelected && (
                        <div className={`p-0.5 rounded-full ${mode.accentColor}`}>
                          <Check className="w-3 h-3 text-white" />
                        </div>
                      )}
                    </div>
                    <p className={`text-sm font-medium mt-0.5 ${isSelected ? mode.textColor + '/80' : 'text-gray-500'}`}>
                      {mode.description}
                    </p>
                    <p className={`text-xs mt-2 ${isSelected ? mode.textColor + '/60' : 'text-gray-400'}`}>
                      {mode.details}
                    </p>
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>
      
      {/* Message d'aide contextuel */}
      {selectedMode === 'visio' && (
        <div className="mt-5 p-4 bg-gradient-to-r from-purple-50 to-fuchsia-50 border border-purple-200 rounded-xl">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              {isMobile ? (
                <Smartphone className="w-5 h-5 text-purple-600" />
              ) : (
                <Monitor className="w-5 h-5 text-purple-600" />
              )}
            </div>
            <div>
              <p className="text-sm font-semibold text-purple-800">Mode Visio activé</p>
              {isMobile ? (
                <p className="text-sm text-purple-600 mt-1 leading-relaxed">
                  📱 Activez le <span className="font-medium">haut-parleur</span> pendant votre réunion. 
                  Le microphone captera l'audio de la conversation.
                </p>
              ) : (
                <p className="text-sm text-purple-600 mt-1 leading-relaxed">
                  💻 Partagez votre <span className="font-medium">écran avec l'audio</span> et autorisez le microphone.
                  Les deux sources seront mixées automatiquement.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
      
      {selectedMode === 'microphone' && (
        <div className="mt-5 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Users className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-blue-800">Mode Présentiel activé</p>
              <p className="text-sm text-blue-600 mt-1 leading-relaxed">
                🎤 Idéal pour les réunions <span className="font-medium">en personne</span>. 
                Placez votre appareil au centre pour une meilleure captation.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

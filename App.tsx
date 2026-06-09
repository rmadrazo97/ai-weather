import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  StatusBar,
  Dimensions,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import HeroScreen from './src/components/HeroScreen';
import DetailsView from './src/components/DetailsView';
import AskButton from './src/components/AskButton';
import ChatSheet from './src/components/ChatSheet';
import CitySheet from './src/components/CitySheet';
import HourlyExpandedSheet from './src/components/HourlyExpandedSheet';
import {
  SCENARIOS,
  PRESET_CITIES,
  wxPickCond,
} from './src/data/weatherData';
import type { Condition, PresetCity, WeatherScenario } from './src/data/weatherData';
import { GRADIENTS, THEME_COLORS } from './src/utils/colors';
import { useStorage } from './src/hooks/useStorage';

const { height: SCREEN_H } = Dimensions.get('window');

export default function App() {
  // Persisted state
  const [customCities, setCustomCities] = useStorage<PresetCity[]>('wxai.cities', []);
  const [activeCity, setActiveCity] = useStorage<PresetCity | null>('wxai.activeCity', null);

  // UI state
  const [unit, setUnit] = useState<'C' | 'F'>('C');
  const [chatOpen, setChatOpen] = useState(false);
  const [citiesOpen, setCitiesOpen] = useState(false);
  const [hourlyOpen, setHourlyOpen] = useState(false);

  const scrollRef = useRef<ScrollView>(null);

  // Resolve current city + weather data
  const city = activeCity ?? PRESET_CITIES[0];
  const condition: Condition = city.cond as Condition;
  const baseWx = SCENARIOS[condition] || SCENARIOS.clear;
  const wx: WeatherScenario = { ...baseWx, location: city.name };

  const grad = GRADIENTS[condition] || GRADIENTS.clear;

  // City management
  const selectCity = useCallback((c: { name: string; cond: string }) => {
    setActiveCity({ name: c.name, cond: c.cond as Condition });
    setCitiesOpen(false);
  }, [setActiveCity]);

  const addCity = useCallback((name: string) => {
    const allCities = [...PRESET_CITIES, ...customCities];
    const exists = allCities.find((c) => c.name.toLowerCase() === name.toLowerCase());
    if (exists) {
      selectCity(exists);
      return;
    }
    const newCity: PresetCity = { name, cond: wxPickCond(name) };
    setCustomCities([...customCities, newCity]);
    selectCity(newCity);
  }, [customCities, setCustomCities, selectCity]);

  const removeCity = useCallback((name: string) => {
    setCustomCities(customCities.filter((c) => c.name !== name));
    if (city.name === name) selectCity(PRESET_CITIES[0]);
  }, [customCities, setCustomCities, city, selectCity]);

  // Scroll to details
  const showDetails = useCallback(() => {
    scrollRef.current?.scrollTo({ y: SCREEN_H, animated: true });
  }, []);

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" />

      {/* Full-screen gradient background */}
      <LinearGradient
        colors={grad.colors}
        locations={grad.locations}
        start={{ x: 0.8, y: 0 }}
        end={{ x: 0.2, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {/* Scrollable content */}
      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        bounces
      >
        <HeroScreen
          wx={wx}
          unit={unit}
          outline={true}
          onUnitChange={setUnit}
          onShowDetails={showDetails}
          onOpenCities={() => setCitiesOpen(true)}
          onExpandHourly={() => setHourlyOpen(true)}
          onAskAI={() => setChatOpen(true)}
        />
        <DetailsView wx={wx} unit={unit} />
      </ScrollView>

      {/* Floating Ask button */}
      <AskButton onPress={() => setChatOpen(true)} />

      {/* Bottom sheets */}
      <ChatSheet
        wx={wx}
        unit={unit}
        visible={chatOpen}
        onClose={() => setChatOpen(false)}
      />
      <CitySheet
        visible={citiesOpen}
        activeCity={city}
        customCities={customCities}
        unit={unit}
        onSelect={selectCity}
        onAdd={addCity}
        onRemove={removeCity}
        onClose={() => setCitiesOpen(false)}
      />
      <HourlyExpandedSheet
        wx={wx}
        unit={unit}
        visible={hourlyOpen}
        onClose={() => setHourlyOpen(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    maxWidth: 540,
    width: '100%',
    alignSelf: 'center',
    paddingBottom: 96,
  },
});

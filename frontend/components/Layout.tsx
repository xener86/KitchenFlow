import React, { useState, useEffect } from 'react';
import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import {
  ChefHat,
  Package,
  BookOpen,
  MapPin,
  BarChart3,
  Settings,
  LogOut,
  Sun,
  Moon,
  Monitor,
  Menu,
  X,
  Sparkles,
  AlertTriangle,
  ShoppingCart
} from 'lucide-react';
import { useIngredients } from '../hooks/useIngredients';
import { getShoppingList } from '../services/recipeService';

export const Layout: React.FC = () => {
  const location = useLocation();
  const { user, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const { ingredients } = useIngredients();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [shoppingCount, setShoppingCount] = useState(0);

  // Count expiring items
  const expiringCount = ingredients.filter(i => i.hasExpiringSoon).length;

  // Count unchecked shopping list items
  useEffect(() => {
    getShoppingList().then(items => {
      setShoppingCount(items.filter(i => !i.isChecked).length);
    }).catch(() => {});
  }, [location.pathname]);

  const cycleTheme = () => {
    const themes: Array<'light' | 'dark' | 'system'> = ['light', 'dark', 'system'];
    const currentIndex = themes.indexOf(theme);
    const nextIndex = (currentIndex + 1) % themes.length;
    setTheme(themes[nextIndex]);
  };

  const themeIcon = {
    light: <Sun className="w-5 h-5" />,
    dark: <Moon className="w-5 h-5" />,
    system: <Monitor className="w-5 h-5" />
  };

  const navItems = [
    { path: '/', icon: Package, label: 'Inventaire' },
    { path: '/recipes', icon: BookOpen, label: 'Recettes' },
    { path: '/storage', icon: MapPin, label: 'Rangements' },
    { path: '/chef', icon: Sparkles, label: 'Chef IA' },
    { path: '/analytics', icon: BarChart3, label: 'Stats' },
    { path: '/settings', icon: Settings, label: 'Paramètres' },
  ];

  const handleLogout = async () => {
    await logout();
    window.location.href = '/login';
  };

  return (
    <div className="min-h-screen bg-stone-50 dark:bg-stone-950">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/80 dark:bg-stone-900/80 backdrop-blur-xl border-b border-stone-200 dark:border-stone-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <NavLink to="/" className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-kitchen-500 to-kitchen-700 flex items-center justify-center shadow-lg">
                <ChefHat className="w-6 h-6 text-white" />
              </div>
              <span className="font-serif text-xl font-semibold text-stone-900 dark:text-white hidden sm:block">
                KitchenFlow
              </span>
            </NavLink>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center gap-1">
              {navItems.map(item => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={({ isActive }) =>
                    `flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
                      isActive
                        ? 'bg-kitchen-100 dark:bg-kitchen-900/30 text-kitchen-700 dark:text-kitchen-400'
                        : 'text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800'
                    }`
                  }
                >
                  <item.icon className="w-5 h-5" />
                  <span className="text-sm font-medium">{item.label}</span>
                </NavLink>
              ))}
            </nav>

            {/* Right Actions */}
            <div className="flex items-center gap-2">
              {/* Shopping List Badge */}
              {shoppingCount > 0 && (
                <NavLink
                  to="/shopping-list"
                  className="relative p-2 text-kitchen-600 dark:text-kitchen-400 hover:bg-kitchen-50 dark:hover:bg-kitchen-900/20 rounded-lg"
                  title={`${shoppingCount} article(s) à acheter`}
                >
                  <ShoppingCart className="w-5 h-5" />
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-kitchen-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
                    {shoppingCount}
                  </span>
                </NavLink>
              )}

              {/* Expiring Alert */}
              {expiringCount > 0 && (
                <NavLink
                  to="/?filter=expiring"
                  className="relative p-2 text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-lg"
                  title={`${expiringCount} produit(s) bientôt périmé(s)`}
                >
                  <AlertTriangle className="w-5 h-5" />
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-amber-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
                    {expiringCount}
                  </span>
                </NavLink>
              )}

              {/* Theme Toggle */}
              <button
                onClick={cycleTheme}
                className="p-2 text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-lg"
                title={`Thème: ${theme}`}
              >
                {themeIcon[theme]}
              </button>

              {/* User Menu */}
              <div className="hidden sm:flex items-center gap-2 pl-2 border-l border-stone-200 dark:border-stone-700">
                <span className="text-sm text-stone-600 dark:text-stone-400">
                  {user?.email}
                </span>
                <button
                  onClick={handleLogout}
                  className="p-2 text-stone-600 dark:text-stone-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 dark:hover:text-red-400 rounded-lg"
                  title="Déconnexion"
                >
                  <LogOut className="w-5 h-5" />
                </button>
              </div>

              {/* Mobile Menu Button */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="md:hidden p-2 text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-lg"
              >
                {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900">
            <nav className="px-4 py-2 space-y-1">
              {navItems.map(item => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  onClick={() => setMobileMenuOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
                      isActive
                        ? 'bg-kitchen-100 dark:bg-kitchen-900/30 text-kitchen-700 dark:text-kitchen-400'
                        : 'text-stone-600 dark:text-stone-400'
                    }`
                  }
                >
                  <item.icon className="w-5 h-5" />
                  <span className="font-medium">{item.label}</span>
                </NavLink>
              ))}
              <button
                onClick={handleLogout}
                className="flex items-center gap-3 px-4 py-3 w-full text-left text-red-600 dark:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20"
              >
                <LogOut className="w-5 h-5" />
                <span className="font-medium">Déconnexion</span>
              </button>
            </nav>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 pb-24 md:pb-6">
        <Outlet />
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-white/90 dark:bg-stone-900/90 backdrop-blur-xl border-t border-stone-200 dark:border-stone-800">
        <div className="flex items-center justify-around h-16">
          {navItems.slice(0, 4).map(item => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-all ${
                  isActive
                    ? 'text-kitchen-600 dark:text-kitchen-400'
                    : 'text-stone-500 dark:text-stone-500'
                }`
              }
            >
              <item.icon className="w-5 h-5" />
              <span className="text-xs font-medium">{item.label}</span>
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
};

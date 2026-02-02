import React, { useState, useEffect, useRef } from 'react';
import { Badge, Form, Dropdown } from 'react-bootstrap';
import { tagAPI, categoryAPI } from '../../services/api';

// Tag Selector Component
export function TagSelector({ selectedTags = [], onChange }) {
  const [tags, setTags] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [showDropdown, setShowDropdown] = useState(false);
  const wrapperRef = useRef(null);
  
  useEffect(() => {
    loadTags();
  }, []);
  
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  
  const loadTags = async () => {
    try {
      const { data } = await tagAPI.list();
      setTags(data.tags || []);
    } catch (error) {
      console.error('Failed to load tags:', error);
    } finally {
      setLoading(false);
    }
  };
  
  const handleToggleTag = (tag) => {
    const tagId = tag._id;
    if (selectedTags.includes(tagId)) {
      onChange(selectedTags.filter(id => id !== tagId));
    } else {
      onChange([...selectedTags, tagId]);
    }
  };
  
  const handleRemoveTag = (tagId) => {
    onChange(selectedTags.filter(id => id !== tagId));
  };
  
  const filteredTags = tags.filter(tag => 
    tag.name.toLowerCase().includes(search.toLowerCase())
  );
  
  const selectedTagObjects = tags.filter(tag => selectedTags.includes(tag._id));
  
  return (
    <div ref={wrapperRef} className="tag-selector">
      {/* Selected Tags Display */}
      <div className="selected-tags d-flex flex-wrap gap-1 mb-2">
        {selectedTagObjects.map(tag => (
          <Badge 
            key={tag._id}
            style={{ 
              backgroundColor: tag.color,
              color: isLightColor(tag.color) ? '#000' : '#fff',
              cursor: 'pointer'
            }}
            onClick={() => handleRemoveTag(tag._id)}
          >
            {tag.name}
            <i className="bi bi-x ms-1"></i>
          </Badge>
        ))}
      </div>
      
      {/* Search Input */}
      <div className="position-relative">
        <Form.Control
          type="text"
          placeholder="Buscar ou selecionar tags..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onFocus={() => setShowDropdown(true)}
          size="sm"
        />
        
        {/* Dropdown */}
        {showDropdown && (
          <div 
            className="position-absolute w-100 bg-white border rounded shadow-sm mt-1" 
            style={{ maxHeight: '200px', overflowY: 'auto', zIndex: 1000 }}
          >
            {loading ? (
              <div className="p-2 text-center text-muted">Carregando...</div>
            ) : filteredTags.length > 0 ? (
              filteredTags.map(tag => (
                <div 
                  key={tag._id}
                  className={`p-2 cursor-pointer hover-bg-light d-flex align-items-center justify-content-between ${
                    selectedTags.includes(tag._id) ? 'bg-light' : ''
                  }`}
                  style={{ cursor: 'pointer' }}
                  onClick={() => handleToggleTag(tag)}
                >
                  <div className="d-flex align-items-center gap-2">
                    <div 
                      style={{ 
                        width: '12px', 
                        height: '12px', 
                        borderRadius: '2px',
                        backgroundColor: tag.color 
                      }}
                    />
                    <span>{tag.name}</span>
                  </div>
                  {selectedTags.includes(tag._id) && (
                    <i className="bi bi-check text-primary"></i>
                  )}
                </div>
              ))
            ) : (
              <div className="p-2 text-center text-muted">
                {search ? 'Nenhuma tag encontrada' : 'Nenhuma tag disponível'}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// Category Selector Component
export function CategorySelector({ selectedCategory, onChange }) {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    loadCategories();
  }, []);
  
  const loadCategories = async () => {
    try {
      const { data } = await categoryAPI.list({ flat: 'true' });
      setCategories(data.categories || []);
    } catch (error) {
      console.error('Failed to load categories:', error);
    } finally {
      setLoading(false);
    }
  };
  
  // Build hierarchy for display
  const buildCategoryOptions = () => {
    const options = [];
    const categoriesMap = new Map();
    
    categories.forEach(cat => categoriesMap.set(cat._id, cat));
    
    const getDepth = (cat, depth = 0) => {
      if (!cat.parent_id) return depth;
      const parent = categoriesMap.get(cat.parent_id);
      return parent ? getDepth(parent, depth + 1) : depth;
    };
    
    // Sort by hierarchy and then by order/name
    const sorted = [...categories].sort((a, b) => {
      const pathA = getPath(a, categoriesMap);
      const pathB = getPath(b, categoriesMap);
      return pathA.localeCompare(pathB);
    });
    
    sorted.forEach(cat => {
      const depth = getDepth(cat);
      options.push({
        ...cat,
        depth,
        displayName: '  '.repeat(depth) + (depth > 0 ? '└ ' : '') + cat.name
      });
    });
    
    return options;
  };
  
  const getPath = (cat, categoriesMap) => {
    if (!cat.parent_id) return cat.name;
    const parent = categoriesMap.get(cat.parent_id);
    return parent ? getPath(parent, categoriesMap) + '/' + cat.name : cat.name;
  };
  
  const categoryOptions = buildCategoryOptions();
  const selectedCategoryObj = categories.find(c => c._id === selectedCategory);
  
  return (
    <div className="category-selector">
      <Form.Select
        value={selectedCategory || ''}
        onChange={(e) => onChange(e.target.value || null)}
        disabled={loading}
      >
        <option value="">Selecione uma categoria...</option>
        {categoryOptions.map(cat => (
          <option key={cat._id} value={cat._id}>
            {cat.displayName}
          </option>
        ))}
      </Form.Select>
      
      {selectedCategoryObj && (
        <div className="mt-2">
          <small className="text-muted">
            <i className={`${selectedCategoryObj.icon || 'bi-folder'} me-1`} style={{ color: selectedCategoryObj.color }}></i>
            {selectedCategoryObj.name}
          </small>
        </div>
      )}
    </div>
  );
}

// Display component for showing tags on a KB
export function TagsDisplay({ tagIds = [], showEmpty = false }) {
  const [tags, setTags] = useState([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    loadTags();
  }, [tagIds]);
  
  const loadTags = async () => {
    if (tagIds.length === 0) {
      setTags([]);
      setLoading(false);
      return;
    }
    
    try {
      const { data } = await tagAPI.list();
      const filtered = (data.tags || []).filter(tag => tagIds.includes(tag._id));
      setTags(filtered);
    } catch (error) {
      console.error('Failed to load tags:', error);
    } finally {
      setLoading(false);
    }
  };
  
  if (loading) return null;
  
  if (tags.length === 0) {
    return showEmpty ? (
      <span className="text-muted">Sem tags</span>
    ) : null;
  }
  
  return (
    <div className="d-flex flex-wrap gap-1">
      {tags.map(tag => (
        <Badge 
          key={tag._id}
          style={{ 
            backgroundColor: tag.color,
            color: isLightColor(tag.color) ? '#000' : '#fff'
          }}
        >
          {tag.name}
        </Badge>
      ))}
    </div>
  );
}

// Display component for showing category on a KB
export function CategoryDisplay({ categoryId, showEmpty = false }) {
  const [category, setCategory] = useState(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    loadCategory();
  }, [categoryId]);
  
  const loadCategory = async () => {
    if (!categoryId) {
      setCategory(null);
      setLoading(false);
      return;
    }
    
    try {
      const { data } = await categoryAPI.list({ flat: 'true' });
      const found = (data.categories || []).find(c => c._id === categoryId);
      setCategory(found || null);
    } catch (error) {
      console.error('Failed to load category:', error);
    } finally {
      setLoading(false);
    }
  };
  
  if (loading) return null;
  
  if (!category) {
    return showEmpty ? (
      <span className="text-muted">Sem categoria</span>
    ) : null;
  }
  
  return (
    <span className="category-display">
      <i className={`${category.icon || 'bi-folder'} me-1`} style={{ color: category.color }}></i>
      {category.name}
    </span>
  );
}

// Helper function to determine if a color is light
function isLightColor(color) {
  if (!color) return false;
  const hex = color.replace('#', '');
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  return brightness > 155;
}

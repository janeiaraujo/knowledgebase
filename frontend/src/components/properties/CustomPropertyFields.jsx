import { useTranslation } from 'react-i18next';
import RichTextEditor from '../RichTextEditor';

export default function CustomPropertyFields({ properties, values, onChange, errors }) {
  const { t } = useTranslation();
  const handleChange = (propertyId, value) => {
    onChange({
      ...values,
      [propertyId]: value
    });
  };

  const renderField = (property) => {
    const value = values[property._id] || property.defaultValue || '';
    const error = errors?.[property._id];

    switch (property.type) {
      case 'text':
        return (
          <input
            type="text"
            className={`form-control ${error ? 'is-invalid' : ''}`}
            value={value}
            onChange={(e) => handleChange(property._id, e.target.value)}
            required={property.required}
            placeholder={`Digite ${property.name.toLowerCase()}`}
          />
        );

      case 'textarea':
        return (
          <RichTextEditor
            value={value}
            onChange={(val) => handleChange(property._id, val)}
            placeholder={`Digite ${property.name.toLowerCase()}`}
            height="200px"
          />
        );

      case 'number':
        return (
          <input
            type="number"
            className={`form-control ${error ? 'is-invalid' : ''}`}
            value={value}
            onChange={(e) => handleChange(property._id, e.target.value)}
            required={property.required}
            placeholder={`Digite ${property.name.toLowerCase()}`}
          />
        );

      case 'select':
        return (
          <select
            className={`form-select ${error ? 'is-invalid' : ''}`}
            value={value}
            onChange={(e) => handleChange(property._id, e.target.value)}
            required={property.required}
          >
            <option value="">{t('customPropertyFields.selecione')}</option>
            {property.options.map((option, idx) => (
              <option key={idx} value={option}>{option}</option>
            ))}
          </select>
        );

      case 'multiselect':
        return (
          <div className={error ? 'is-invalid' : ''}>
            {property.options.map((option, idx) => (
              <div key={idx} className="form-check">
                <input
                  type="checkbox"
                  className="form-check-input"
                  id={`${property._id}-${idx}`}
                  checked={(value || []).includes(option)}
                  onChange={(e) => {
                    const currentValues = value || [];
                    const newValues = e.target.checked
                      ? [...currentValues, option]
                      : currentValues.filter(v => v !== option);
                    handleChange(property._id, newValues);
                  }}
                />
                <label className="form-check-label" htmlFor={`${property._id}-${idx}`}>
                  {option}
                </label>
              </div>
            ))}
          </div>
        );

      case 'date':
        return (
          <input
            type="date"
            className={`form-control ${error ? 'is-invalid' : ''}`}
            value={value}
            onChange={(e) => handleChange(property._id, e.target.value)}
            required={property.required}
          />
        );

      case 'url':
        return (
          <input
            type="url"
            className={`form-control ${error ? 'is-invalid' : ''}`}
            value={value}
            onChange={(e) => handleChange(property._id, e.target.value)}
            required={property.required}
            placeholder="https://"
          />
        );

      case 'email':
        return (
          <input
            type="email"
            className={`form-control ${error ? 'is-invalid' : ''}`}
            value={value}
            onChange={(e) => handleChange(property._id, e.target.value)}
            required={property.required}
            placeholder="email@example.com"
          />
        );

      case 'phone':
        return (
          <input
            type="tel"
            className={`form-control ${error ? 'is-invalid' : ''}`}
            value={value}
            onChange={(e) => handleChange(property._id, e.target.value)}
            required={property.required}
            placeholder="(00) 00000-0000"
          />
        );

      case 'checkbox':
        return (
          <div className="form-check">
            <input
              type="checkbox"
              className={`form-check-input ${error ? 'is-invalid' : ''}`}
              checked={value === true || value === 'true'}
              onChange={(e) => handleChange(property._id, e.target.checked)}
              id={property._id}
            />
            <label className="form-check-label" htmlFor={property._id}>
              {property.name}
            </label>
          </div>
        );

      case 'file':
        return (
          <input
            type="file"
            className={`form-control ${error ? 'is-invalid' : ''}`}
            onChange={(e) => {
              const file = e.target.files[0];
              if (file) {
                handleChange(property._id, file.name);
              }
            }}
            required={property.required}
          />
        );

      default:
        return <input type="text" className="form-control" value={value} readOnly />;
    }
  };

  if (!properties || properties.length === 0) {
    return null;
  }

  return (
    <>
      {properties.map((property) => (
        <div key={property._id} className="mb-3">
          <label className="form-label">
            {property.name}
            {property.required && <span className="text-danger"> *</span>}
          </label>
          {renderField(property)}
          {errors?.[property._id] && (
            <div className="invalid-feedback d-block">{errors[property._id]}</div>
          )}
        </div>
      ))}
    </>
  );
}

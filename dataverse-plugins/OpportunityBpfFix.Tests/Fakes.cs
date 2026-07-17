using System;
using System.Collections.Generic;
using Microsoft.Xrm.Sdk;
using Microsoft.Xrm.Sdk.Query;

namespace OpportunityBpfFix.Tests
{
    // Minimal hand-rolled fakes for the Dataverse SDK plugin-hosting
    // interfaces, so plugin logic can be exercised in a plain xunit test
    // without a live Dataverse org. Only the members RepopulateBpfFields
    // actually touches are meaningfully implemented; everything else on
    // IExecutionContext returns a harmless default.
    public class FakePluginExecutionContext : IPluginExecutionContext
    {
        public int Stage { get; set; }
        public IPluginExecutionContext ParentContext { get; set; }
        public int Mode { get; set; }
        public int IsolationMode { get; set; }
        public int Depth { get; set; }
        public string MessageName { get; set; }
        public string PrimaryEntityName { get; set; }
        public Guid? RequestId { get; set; }
        public string SecondaryEntityName { get; set; }
        public ParameterCollection InputParameters { get; set; } = new ParameterCollection();
        public ParameterCollection OutputParameters { get; set; } = new ParameterCollection();
        public ParameterCollection SharedVariables { get; set; } = new ParameterCollection();
        public Guid UserId { get; set; }
        public Guid InitiatingUserId { get; set; }
        public Guid BusinessUnitId { get; set; }
        public Guid OrganizationId { get; set; }
        public string OrganizationName { get; set; }
        public Guid PrimaryEntityId { get; set; }
        public EntityImageCollection PreEntityImages { get; set; } = new EntityImageCollection();
        public EntityImageCollection PostEntityImages { get; set; } = new EntityImageCollection();
        public EntityReference OwningExtension { get; set; }
        public Guid CorrelationId { get; set; }
        public bool IsExecutingOffline { get; set; }
        public bool IsOfflinePlayback { get; set; }
        public bool IsInTransaction { get; set; }
        public Guid OperationId { get; set; }
        public DateTime OperationCreatedOn { get; set; }
    }

    // Records every RetrieveMultiple call it receives (for assertions) and
    // returns a canned result keyed by the requested column set.
    public class FakeOrganizationService : IOrganizationService
    {
        public List<QueryExpression> RetrieveMultipleCalls { get; } = new List<QueryExpression>();
        public Entity RetrieveMultipleResult { get; set; }

        public EntityCollection RetrieveMultiple(QueryBase query)
        {
            RetrieveMultipleCalls.Add((QueryExpression)query);
            var result = new EntityCollection();
            if (RetrieveMultipleResult != null) result.Entities.Add(RetrieveMultipleResult);
            return result;
        }

        public Guid Create(Entity entity) => throw new NotImplementedException();
        public Entity Retrieve(string entityName, Guid id, ColumnSet columnSet) => throw new NotImplementedException();
        public void Update(Entity entity) => throw new NotImplementedException();
        public void Delete(string entityName, Guid id) => throw new NotImplementedException();
        public OrganizationResponse Execute(OrganizationRequest request) => throw new NotImplementedException();
        public void Associate(string entityName, Guid entityId, Relationship relationship, EntityReferenceCollection relatedEntities) => throw new NotImplementedException();
        public void Disassociate(string entityName, Guid entityId, Relationship relationship, EntityReferenceCollection relatedEntities) => throw new NotImplementedException();
    }

    public class FakeOrganizationServiceFactory : IOrganizationServiceFactory
    {
        private readonly IOrganizationService _service;
        public FakeOrganizationServiceFactory(IOrganizationService service) => _service = service;
        public IOrganizationService CreateOrganizationService(Guid? userId) => _service;
    }

    public class FakeServiceProvider : IServiceProvider
    {
        private readonly Dictionary<Type, object> _services = new Dictionary<Type, object>();
        public void Register<T>(T instance) => _services[typeof(T)] = instance;
        public object GetService(Type serviceType) => _services.TryGetValue(serviceType, out var svc) ? svc : null;
    }
}

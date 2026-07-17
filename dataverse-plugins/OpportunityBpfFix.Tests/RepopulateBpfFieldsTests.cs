using System;
using Microsoft.Xrm.Sdk;
using Microsoft.Xrm.Sdk.Query;
using Xunit;

namespace OpportunityBpfFix.Tests
{
    public class RepopulateBpfFieldsTests
    {
        private static readonly Guid OpportunityId = Guid.NewGuid();
        private static readonly Guid StageId = Guid.NewGuid();
        private static readonly Guid ProcessId = Guid.NewGuid();
        private const string TraversedPath = "some,path";

        private static (FakeServiceProvider provider, FakePluginExecutionContext context, FakeOrganizationService service) Build(
            string messageName, int stage, Entity businessEntity, ColumnSet requestedColumns = null)
        {
            var context = new FakePluginExecutionContext { MessageName = messageName, Stage = stage };
            context.OutputParameters["BusinessEntity"] = businessEntity;
            if (requestedColumns != null) context.InputParameters["ColumnSet"] = requestedColumns;

            var freshEntity = new Entity("opportunity", OpportunityId);
            freshEntity["stageid"] = StageId;
            freshEntity["processid"] = ProcessId;
            freshEntity["traversedpath"] = TraversedPath;

            var service = new FakeOrganizationService { RetrieveMultipleResult = freshEntity };
            var provider = new FakeServiceProvider();
            provider.Register<IPluginExecutionContext>(context);
            provider.Register<IOrganizationServiceFactory>(new FakeOrganizationServiceFactory(service));

            return (provider, context, service);
        }

        [Fact]
        public void Ignores_non_Retrieve_messages()
        {
            var entity = new Entity("opportunity", OpportunityId);
            entity["stageid"] = null;
            var (provider, _, service) = Build("Update", 40, entity, new ColumnSet("stageid"));

            new RepopulateBpfFields().Execute(provider);

            Assert.Empty(service.RetrieveMultipleCalls);
        }

        [Fact]
        public void Ignores_stages_other_than_PostOperation()
        {
            var entity = new Entity("opportunity", OpportunityId);
            entity["stageid"] = null;
            var (provider, _, service) = Build("Retrieve", 20, entity, new ColumnSet("stageid"));

            new RepopulateBpfFields().Execute(provider);

            Assert.Empty(service.RetrieveMultipleCalls);
        }

        [Fact]
        public void Ignores_entities_other_than_opportunity()
        {
            var entity = new Entity("contact", OpportunityId);
            entity["stageid"] = null;
            var (provider, _, service) = Build("Retrieve", 40, entity, new ColumnSet("stageid"));

            new RepopulateBpfFields().Execute(provider);

            Assert.Empty(service.RetrieveMultipleCalls);
        }

        [Fact]
        public void Does_nothing_when_requested_fields_are_already_present_and_non_null()
        {
            var entity = new Entity("opportunity", OpportunityId);
            entity["stageid"] = StageId;
            var (provider, context, service) = Build("Retrieve", 40, entity, new ColumnSet("stageid"));

            new RepopulateBpfFields().Execute(provider);

            Assert.Empty(service.RetrieveMultipleCalls);
            Assert.Equal(StageId, ((Entity)context.OutputParameters["BusinessEntity"])["stageid"]);
        }

        [Fact]
        public void Repopulates_fields_that_are_missing_entirely_from_the_entity()
        {
            // Mirrors the real bug: the stock plugin removes the attribute
            // rather than setting it to null.
            var entity = new Entity("opportunity", OpportunityId);
            var (provider, context, service) = Build(
                "Retrieve", 40, entity, new ColumnSet("stageid", "processid", "traversedpath"));

            new RepopulateBpfFields().Execute(provider);

            Assert.Single(service.RetrieveMultipleCalls);
            var fixedEntity = (Entity)context.OutputParameters["BusinessEntity"];
            Assert.Equal(StageId, fixedEntity["stageid"]);
            Assert.Equal(ProcessId, fixedEntity["processid"]);
            Assert.Equal(TraversedPath, fixedEntity["traversedpath"]);
        }

        [Fact]
        public void Repopulates_fields_present_with_an_explicit_null_value()
        {
            var entity = new Entity("opportunity", OpportunityId);
            entity["stageid"] = null;
            var (provider, context, service) = Build("Retrieve", 40, entity, new ColumnSet("stageid"));

            new RepopulateBpfFields().Execute(provider);

            Assert.Single(service.RetrieveMultipleCalls);
            Assert.Equal(StageId, ((Entity)context.OutputParameters["BusinessEntity"])["stageid"]);
        }

        [Fact]
        public void Skips_fields_the_caller_never_requested()
        {
            // stageid is missing on the entity, but the caller's $select
            // never asked for it (only "name") — must not trigger a fetch.
            var entity = new Entity("opportunity", OpportunityId);
            var (provider, _, service) = Build("Retrieve", 40, entity, new ColumnSet("name"));

            new RepopulateBpfFields().Execute(provider);

            Assert.Empty(service.RetrieveMultipleCalls);
        }

        [Fact]
        public void Treats_AllColumns_as_requesting_every_bpf_field()
        {
            var entity = new Entity("opportunity", OpportunityId);
            var (provider, context, service) = Build("Retrieve", 40, entity, new ColumnSet(true));

            new RepopulateBpfFields().Execute(provider);

            Assert.Single(service.RetrieveMultipleCalls);
            var fixedEntity = (Entity)context.OutputParameters["BusinessEntity"];
            Assert.Equal(StageId, fixedEntity["stageid"]);
            Assert.Equal(ProcessId, fixedEntity["processid"]);
            Assert.Equal(TraversedPath, fixedEntity["traversedpath"]);
        }

        [Fact]
        public void Filters_the_RetrieveMultiple_query_to_the_target_opportunity()
        {
            var entity = new Entity("opportunity", OpportunityId);
            var (provider, _, service) = Build("Retrieve", 40, entity, new ColumnSet("stageid"));

            new RepopulateBpfFields().Execute(provider);

            var query = service.RetrieveMultipleCalls[0];
            Assert.Equal("opportunity", query.EntityName);
            var condition = query.Criteria.Conditions[0];
            Assert.Equal("opportunityid", condition.AttributeName);
            Assert.Equal(OpportunityId, condition.Values[0]);
        }
    }
}
